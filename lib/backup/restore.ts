import { promises as fs } from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { prisma } from "@/lib/db/client";
import { buildCreateData } from "@/lib/db/clothing";
import { randomToken } from "@/lib/db/ids";
import { imagesDir, thumbsDir, tmpDir } from "@/lib/config";
import { createThumbnail, isSafeStoredName } from "@/lib/images/storage";
import { sha256 } from "@/lib/images/hash";
import { sniffImageType } from "@/lib/images/validate";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";
import { backupDocumentSchema, type BackupDocument } from "./format";

export type RestoreMode = "merge" | "replace";

export interface RestoreResult {
  ok: boolean;
  itemsRestored: number;
  itemsSkipped: number;
  outfitsRestored: number;
  outfitsSkipped: number;
  missingImages: string[];
  errors: string[];
}

const MAX_ENTRY_BYTES = 60 * 1024 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024 * 1024;

function fail(errors: string[]): RestoreResult {
  return { ok: false, itemsRestored: 0, itemsSkipped: 0, outfitsRestored: 0, outfitsSkipped: 0, missingImages: [], errors };
}

/** Read and validate a backup archive (or a bare database.json). Never trusts paths inside the zip. */
export function readBackupArchive(data: Uint8Array): { doc: BackupDocument | null; images: Map<string, Uint8Array>; errors: string[] } {
  const images = new Map<string, Uint8Array>();
  let jsonText: string | null = null;

  const isZip = data.length > 4 && data[0] === 0x50 && data[1] === 0x4b;
  if (isZip) {
    let total = 0;
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(data, {
        filter: (f) => {
          total += f.originalSize;
          if (f.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES) throw new Error(`Archive entry too large: ${f.name}`);
          return f.name === "database.json" || /^images\/[^/]+$/.test(f.name);
        },
      });
    } catch (e) {
      return { doc: null, images, errors: [`Could not read the zip archive: ${e instanceof Error ? e.message : String(e)}`] };
    }
    if (!files["database.json"]) return { doc: null, images, errors: ["The archive has no database.json."] };
    jsonText = strFromU8(files["database.json"]);
    for (const [name, bytes] of Object.entries(files)) {
      if (!name.startsWith("images/")) continue;
      const base = name.slice("images/".length);
      if (isSafeStoredName(base)) images.set(base, bytes);
    }
  } else {
    jsonText = strFromU8(data);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { doc: null, images, errors: [`database.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }
  const result = backupDocumentSchema.safeParse(parsed);
  if (!result.success) return { doc: null, images, errors: formatZodIssues(result.error).slice(0, 20) };
  return { doc: result.data, images, errors: [] };
}

/**
 * Restore a backup.
 *  - merge:   add items/outfits whose IDs are not in the wardrobe yet
 *  - replace: wipe the wardrobe and restore exactly what is in the backup
 * Images are written to a temp folder first and only moved into place after the
 * database transaction succeeds.
 */
export async function restoreBackup(data: Uint8Array, mode: RestoreMode): Promise<RestoreResult> {
  const { doc, images, errors } = readBackupArchive(data);
  if (!doc) return fail(errors);

  const existingIds = new Set(
    mode === "merge" ? (await prisma.clothingItem.findMany({ select: { id: true } })).map((r) => r.id) : [],
  );
  const existingOutfitIds = new Set(
    mode === "merge" ? (await prisma.outfit.findMany({ select: { id: true } })).map((r) => r.id) : [],
  );

  const problems: string[] = [];
  const missingImages: string[] = [];
  const creates: ReturnType<typeof buildCreateData>[] = [];
  const pendingImages: { id: string; name: string; bytes: Uint8Array }[] = [];
  let itemsSkipped = 0;
  const seen = new Set<string>();

  for (const item of doc.items) {
    if (seen.has(item.id)) {
      problems.push(`Duplicate item id ${item.id} in backup.`);
      continue;
    }
    seen.add(item.id);
    if (existingIds.has(item.id)) {
      itemsSkipped++;
      continue;
    }
    const meta = clothingItemInputSchema.safeParse(item.metadata);
    if (!meta.success) {
      problems.push(`Item ${item.id}: ${formatZodIssues(meta.error).join("; ")}`);
      continue;
    }
    let image: Parameters<typeof buildCreateData>[0]["image"] = undefined;
    const imgName = item.image?.path ?? null;
    if (imgName) {
      const bytes = images.get(imgName);
      const ext = bytes ? sniffImageType(bytes) : null;
      if (!bytes || !ext) {
        missingImages.push(imgName);
      } else {
        const name = `${item.id}.${ext}`;
        pendingImages.push({ id: item.id, name, bytes });
        image = {
          imagePath: name,
          originalFilename: item.image?.originalFilename ?? null,
          imageHash: sha256(bytes),
          imageMime: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
          imageSize: bytes.length,
          imageWidth: item.image?.width ?? null,
          imageHeight: item.image?.height ?? null,
        };
      }
    }
    creates.push(
      buildCreateData({
        id: item.id,
        input: meta.data,
        image,
        source: item.source,
        aiGenerated: item.aiGenerated,
        inferredFields: item.inferredFields,
        editedFields: item.editedFields,
        rawImport: undefined,
        createdAt: item.createdAt ? new Date(item.createdAt) : undefined,
      }),
    );
    if (item.rawImport) creates[creates.length - 1].rawImport = item.rawImport;
  }
  if (problems.length) return fail(problems.slice(0, 30));

  const finalItemIds = new Set([...existingIds, ...creates.map((c) => c.id)]);
  const outfits = doc.outfits.filter((o) => !existingOutfitIds.has(o.id));
  const outfitsSkipped = doc.outfits.length - outfits.length;

  // Stage images in a temp directory
  const staging = path.join(tmpDir(), `restore-${randomToken(8)}`);
  await fs.mkdir(staging, { recursive: true });
  try {
    for (const img of pendingImages) await fs.writeFile(path.join(staging, img.name), img.bytes);

    await prisma.$transaction(
      async (tx) => {
        if (mode === "replace") {
          await tx.outfitItem.deleteMany({});
          await tx.outfit.deleteMany({});
          await tx.clothingItem.deleteMany({});
        }
        for (const data of creates) await tx.clothingItem.create({ data });
        for (const o of outfits) {
          await tx.outfit.create({
            data: {
              id: o.id,
              name: o.name,
              description: o.description ?? null,
              occasion: o.occasion ?? null,
              season: o.season ?? null,
              style: o.style ?? null,
              explanation: o.explanation ?? null,
              source: o.source,
              ...(o.createdAt ? { createdAt: new Date(o.createdAt) } : {}),
              items: {
                create: o.items
                  .filter((i) => finalItemIds.has(i.clothingItemId))
                  .filter((i, idx, arr) => arr.findIndex((x) => x.clothingItemId === i.clothingItemId) === idx)
                  .map((i) => ({ clothingItemId: i.clothingItemId, role: i.role, position: i.position })),
              },
            },
          });
        }
      },
      { timeout: 120_000 },
    );
  } catch (e) {
    await fs.rm(staging, { recursive: true, force: true });
    return fail([`Restore failed, nothing was changed: ${e instanceof Error ? e.message : String(e)}`]);
  }

  // Move images into place; in replace mode remove files that no longer belong to any item.
  await fs.mkdir(imagesDir(), { recursive: true });
  const keep = new Set<string>();
  for (const img of pendingImages) {
    await fs.rename(path.join(staging, img.name), path.join(imagesDir(), img.name)).catch(async () => {
      await fs.copyFile(path.join(staging, img.name), path.join(imagesDir(), img.name));
    });
    keep.add(img.name);
    await fs.rm(path.join(thumbsDir(), `${img.id}.webp`), { force: true });
    await createThumbnail(path.join(imagesDir(), img.name), img.id).catch(() => undefined);
  }
  await fs.rm(staging, { recursive: true, force: true });
  if (mode === "replace") {
    const rows = await prisma.clothingItem.findMany({ select: { id: true, imagePath: true } });
    const live = new Set(rows.map((r) => r.imagePath).filter(Boolean) as string[]);
    const liveIds = new Set(rows.map((r) => r.id));
    for (const f of await fs.readdir(imagesDir()).catch(() => [] as string[])) {
      if (isSafeStoredName(f) && !live.has(f)) await fs.rm(path.join(imagesDir(), f), { force: true });
    }
    for (const f of await fs.readdir(thumbsDir()).catch(() => [] as string[])) {
      if (f.endsWith(".webp") && !liveIds.has(f.slice(0, -5))) await fs.rm(path.join(thumbsDir(), f), { force: true });
    }
  }

  return {
    ok: true,
    itemsRestored: creates.length,
    itemsSkipped,
    outfitsRestored: outfits.length,
    outfitsSkipped,
    missingImages,
    errors: [],
  };
}
