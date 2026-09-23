import { EDITABLE_FIELDS } from "@/lib/constants/fields";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";
import type { ClothingItemInput } from "@/lib/types";
import { newClothingId } from "./ids";
import { deleteItemFiles, storeItemImage, type StagedImage } from "./images";
import { applyImportedMetadata, buildRow, findItemsByHashes, insertRow, type ClothingRow } from "./items";
import type { Services } from "./services";

export type DuplicateAction = "skip" | "replace" | "add";

export interface CommitItem {
  staged: StagedImage;
  input: unknown;
  inferredFields: string[];
  /** Fields the user corrected in the preview (protected from future imports). */
  editedFields: string[];
  raw?: unknown;
  source: "claude" | "manual";
  duplicateAction?: DuplicateAction | null;
}

export interface CommitResult {
  ok: boolean;
  created: { index: number; id: string; name: string }[];
  replaced: { index: number; id: string; name: string }[];
  skipped: { index: number; duplicateOf: string }[];
  errors: { index: number; message: string }[];
}

const failure = (errors: CommitResult["errors"]): CommitResult => ({ ok: false, created: [], replaced: [], skipped: [], errors });

/**
 * Save a previewed import — all or nothing.
 * 1. re-validate every item  2. require a decision for each duplicate photo
 * 3. copy photos into the wardrobe, then one DB transaction; undo the copies if anything fails.
 */
export async function commitImport(svc: Services, items: CommitItem[]): Promise<CommitResult> {
  if (items.length === 0) return failure([{ index: -1, message: "Nothing to import." }]);
  const errors: CommitResult["errors"] = [];
  const planned: { index: number; input: ClothingItemInput; item: CommitItem }[] = [];
  const usedKeys = new Set<string>();

  for (const [index, item] of items.entries()) {
    const parsed = clothingItemInputSchema.safeParse(item.input);
    if (!parsed.success) {
      errors.push({ index, message: formatZodIssues(parsed.error).join("; ") });
      continue;
    }
    if (usedKeys.has(item.staged.key)) {
      errors.push({ index, message: "The same photo is assigned to two items." });
      continue;
    }
    usedKeys.add(item.staged.key);
    if (!(await svc.files.exists(item.staged.path))) {
      errors.push({ index, message: "The photo is no longer available — pick it again." });
      continue;
    }
    planned.push({ index, input: parsed.data, item });
  }
  if (errors.length) return failure(errors);

  const existing = await findItemsByHashes(svc.db, planned.map((p) => p.item.staged.hash));
  const firstInBatch = new Map<string, number>();
  const actions: ("create" | "replace" | "skip")[] = [];
  for (const p of planned) {
    const hash = p.item.staged.hash;
    const dup = existing.get(hash);
    const action = p.item.duplicateAction ?? null;
    if (dup) {
      if (!action) errors.push({ index: p.index, message: `This clothing image already exists ("${dup.name}"). Choose Skip, Replace metadata or Add anyway.` });
      actions.push(action === "add" ? "create" : action === "replace" ? "replace" : "skip");
    } else if (firstInBatch.has(hash)) {
      if (action !== "add" && action !== "skip") {
        errors.push({ index: p.index, message: `The same photo is used by item #${firstInBatch.get(hash)! + 1} in this import. Choose Skip or Add anyway.` });
      }
      actions.push(action === "add" ? "create" : "skip");
    } else {
      actions.push("create");
    }
    if (!firstInBatch.has(hash)) firstInBatch.set(hash, p.index);
  }
  if (errors.length) return failure(errors);

  const result: CommitResult = { ok: true, created: [], replaced: [], skipped: [], errors: [] };
  const writtenImages: string[] = [];
  const rows: { index: number; row: ClothingRow }[] = [];
  try {
    for (const [i, p] of planned.entries()) {
      if (actions[i] === "skip") {
        result.skipped.push({ index: p.index, duplicateOf: existing.get(p.item.staged.hash)?.id ?? "" });
        continue;
      }
      if (actions[i] === "replace") continue;
      const id = newClothingId(svc);
      const s = p.item.staged;
      const stored = await storeItemImage(svc, id, s.path, s.ext, s.hash);
      writtenImages.push(stored.imagePath);
      rows.push({
        index: p.index,
        row: buildRow(svc, {
          id,
          input: p.input,
          source: p.item.source,
          aiGenerated: p.item.source === "claude",
          inferredFields: p.item.inferredFields,
          editedFields: p.item.editedFields.filter((f) => (EDITABLE_FIELDS as readonly string[]).includes(f)),
          rawImport: p.item.raw,
          image: {
            imagePath: stored.imagePath,
            originalFilename: s.originalName,
            imageHash: s.hash,
            imageMime: s.mime,
            imageSize: s.size,
            imageWidth: stored.width,
            imageHeight: stored.height,
          },
        }),
      });
    }
  } catch (e) {
    for (const img of writtenImages) await deleteItemFiles(svc, img);
    return failure([{ index: -1, message: `Could not save photos: ${e instanceof Error ? e.message : String(e)}. Nothing was imported.` }]);
  }

  try {
    await svc.db.transaction(async (tx) => {
      for (const { index, row } of rows) {
        await insertRow(tx, row);
        result.created.push({ index, id: row.id, name: row.name });
      }
      for (const [i, p] of planned.entries()) {
        if (actions[i] !== "replace") continue;
        const dup = existing.get(p.item.staged.hash)!;
        const updated = await applyImportedMetadata(tx, dup.id, p.input, {
          inferredFields: p.item.inferredFields,
          rawImport: p.item.raw ?? p.item.input,
          source: p.item.source,
        });
        if (updated) result.replaced.push({ index: p.index, id: updated.id, name: updated.name });
      }
    });
  } catch (e) {
    for (const img of writtenImages) await deleteItemFiles(svc, img);
    return failure([{ index: -1, message: `Database error: ${e instanceof Error ? e.message : String(e)}. Nothing was imported.` }]);
  }
  return result;
}
