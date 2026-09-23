import { z } from "zod";
import { EDITABLE_FIELDS } from "@/lib/constants/fields";
import { prisma } from "@/lib/db/client";
import { buildCreateData, findItemsByHashes, applyImportedMetadata } from "@/lib/db/clothing";
import { newClothingId } from "@/lib/db/ids";
import { deleteItemImage, saveItemImage } from "@/lib/images/storage";
import { getStagedFile, removeStagingSession, StagingError } from "@/lib/images/staging";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { formatZodIssues, textList } from "@/lib/validation/primitives";

export const DUPLICATE_ACTIONS = ["skip", "replace", "add"] as const;
export type DuplicateAction = (typeof DUPLICATE_ACTIONS)[number];

export const commitItemSchema = z.object({
  /** Key of the staged image (from /api/import/stage). */
  stagedKey: z.string().regex(/^[a-z0-9]{6,32}$/, "invalid staged image key"),
  input: z.unknown(),
  inferredFields: textList,
  /** Fields the user corrected in the preview before importing (protected from future imports). */
  editedFields: z.array(z.string().max(50)).max(50).default([]),
  raw: z.unknown().optional(),
  source: z.enum(["claude", "manual"]).default("claude"),
  duplicateAction: z.enum(DUPLICATE_ACTIONS).nullish(),
});

export const commitRequestSchema = z.object({
  sessionId: z.string().regex(/^[a-z0-9]{6,32}$/, "invalid import session"),
  items: z.array(commitItemSchema).min(1, "Nothing to import").max(2000),
});

export type CommitRequest = z.infer<typeof commitRequestSchema>;

export interface CommitIssue {
  index: number;
  message: string;
}

export interface CommitResult {
  ok: boolean;
  created: { index: number; id: string; name: string }[];
  replaced: { index: number; id: string; name: string }[];
  skipped: { index: number; duplicateOf: string }[];
  errors: CommitIssue[];
}

function failure(errors: CommitIssue[]): CommitResult {
  return { ok: false, created: [], replaced: [], skipped: [], errors };
}

/**
 * Commit a previewed import. All-or-nothing:
 *   1. re-validate every item and staged image
 *   2. resolve duplicates (an explicit decision is required for each one)
 *   3. write image files, then one DB transaction
 * If any step fails, files written so far are removed and nothing is saved.
 */
export async function commitImport(request: CommitRequest): Promise<CommitResult> {
  const errors: CommitIssue[] = [];

  // 1. Validate metadata + load staged images
  type Planned = {
    index: number;
    input: z.infer<typeof clothingItemInputSchema>;
    staged: NonNullable<Awaited<ReturnType<typeof getStagedFile>>>;
    item: CommitRequest["items"][number];
  };
  const planned: Planned[] = [];
  const usedKeys = new Set<string>();
  for (const [index, item] of request.items.entries()) {
    const parsed = clothingItemInputSchema.safeParse(item.input);
    if (!parsed.success) {
      errors.push({ index, message: formatZodIssues(parsed.error).join("; ") });
      continue;
    }
    if (usedKeys.has(item.stagedKey)) {
      errors.push({ index, message: "The same image is assigned to two items." });
      continue;
    }
    usedKeys.add(item.stagedKey);
    let staged: Awaited<ReturnType<typeof getStagedFile>>;
    try {
      staged = await getStagedFile(request.sessionId, item.stagedKey);
    } catch (e) {
      if (e instanceof StagingError) return failure([{ index, message: e.message }]);
      throw e;
    }
    if (!staged) {
      errors.push({ index, message: "The uploaded image is missing — the import session may have expired. Please re-upload." });
      continue;
    }
    planned.push({ index, input: parsed.data, staged, item });
  }
  if (errors.length) return failure(errors);

  // 2. Duplicates: against the wardrobe and within this batch
  const existing = await findItemsByHashes(planned.map((p) => p.staged.meta.hash));
  const firstInBatch = new Map<string, number>();
  const actions: ("create" | "replace" | "skip")[] = [];
  for (const p of planned) {
    const hash = p.staged.meta.hash;
    const dup = existing.get(hash);
    const earlier = firstInBatch.get(hash);
    const action = p.item.duplicateAction ?? null;
    if (dup) {
      if (!action) {
        errors.push({ index: p.index, message: `This clothing image already exists ("${dup.name}"). Choose Skip, Replace metadata or Add anyway.` });
        actions.push("skip");
        continue;
      }
      actions.push(action === "add" ? "create" : action === "replace" ? "replace" : "skip");
    } else if (earlier !== undefined) {
      if (action !== "add" && action !== "skip") {
        errors.push({ index: p.index, message: `The same image is used by item #${earlier + 1} in this import. Choose Skip or Add anyway.` });
        actions.push("skip");
        continue;
      }
      actions.push(action === "add" ? "create" : "skip");
    } else {
      actions.push("create");
    }
    if (!firstInBatch.has(hash)) firstInBatch.set(hash, p.index);
  }
  if (errors.length) return failure(errors);

  // 3a. Write image files for new items
  const result: CommitResult = { ok: true, created: [], replaced: [], skipped: [], errors: [] };
  const written: string[] = [];
  const creates: { index: number; data: ReturnType<typeof buildCreateData> }[] = [];
  try {
    for (const [i, p] of planned.entries()) {
      const action = actions[i];
      if (action === "skip") {
        result.skipped.push({ index: p.index, duplicateOf: existing.get(p.staged.meta.hash)?.id ?? "" });
        continue;
      }
      if (action === "replace") continue;
      const id = newClothingId();
      const stored = await saveItemImage(id, p.staged.data, p.staged.meta.ext);
      written.push(id);
      creates.push({
        index: p.index,
        data: buildCreateData({
          id,
          input: p.input,
          source: p.item.source,
          aiGenerated: p.item.source === "claude",
          inferredFields: p.item.inferredFields,
          editedFields: p.item.editedFields.filter((f) => (EDITABLE_FIELDS as readonly string[]).includes(f)),
          rawImport: p.item.raw,
          image: {
            imagePath: stored.imagePath,
            originalFilename: p.staged.meta.originalName,
            imageHash: p.staged.meta.hash,
            imageMime: p.staged.meta.mime,
            imageSize: p.staged.meta.size,
            imageWidth: stored.width,
            imageHeight: stored.height,
          },
        }),
      });
    }
  } catch (e) {
    await Promise.all(written.map((id) => cleanupImageFiles(id)));
    return failure([{ index: -1, message: `Could not save images: ${e instanceof Error ? e.message : String(e)}. Nothing was imported.` }]);
  }

  // 3b. Single DB transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (const c of creates) {
        const row = await tx.clothingItem.create({ data: c.data });
        result.created.push({ index: c.index, id: row.id, name: row.name });
      }
      for (const [i, p] of planned.entries()) {
        if (actions[i] !== "replace") continue;
        const dup = existing.get(p.staged.meta.hash)!;
        const updated = await applyImportedMetadata(
          dup.id,
          p.input,
          { inferredFields: p.item.inferredFields, rawImport: p.item.raw ?? p.item.input, source: p.item.source },
          tx,
        );
        if (updated) result.replaced.push({ index: p.index, id: updated.id, name: updated.name });
      }
    }, { timeout: 60_000 });
  } catch (e) {
    await Promise.all(written.map((id) => cleanupImageFiles(id)));
    return failure([{ index: -1, message: `Database error: ${e instanceof Error ? e.message : String(e)}. Nothing was imported.` }]);
  }

  await removeStagingSession(request.sessionId).catch(() => undefined);
  return result;
}

async function cleanupImageFiles(id: string) {
  for (const ext of ["jpg", "png", "webp"]) await deleteItemImage(id, `${id}.${ext}`).catch(() => undefined);
}
