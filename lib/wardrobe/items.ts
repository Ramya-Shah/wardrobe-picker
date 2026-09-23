import { promises as fs } from "node:fs";
import { prisma } from "@/lib/db/client";
import { createItem, deleteItemRecord, getItem, getRawImport, updateItemImage, findItemsByHashes } from "@/lib/db/clothing";
import { newClothingId } from "@/lib/db/ids";
import { copyItemImage, deleteItemImage, saveItemImage } from "@/lib/images/storage";
import { sha256 } from "@/lib/images/hash";
import { sanitizeFilename, validateImage } from "@/lib/images/validate";
import { imagesDir, stagingDir, thumbsDir } from "@/lib/config";
import type { ClothingItem } from "@/lib/types";

/** Operations that touch both the database and the image files. */

export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export async function deleteItem(id: string, opts: { keepImage?: boolean } = {}): Promise<ClothingItem> {
  const deleted = await deleteItemRecord(id);
  if (!deleted) throw new NotFoundError("Clothing item not found.");
  if (!opts.keepImage) await deleteItemImage(id, deleted.imagePath);
  return deleted;
}

export async function duplicateItem(id: string): Promise<ClothingItem> {
  const source = await getItem(id);
  if (!source) throw new NotFoundError("Clothing item not found.");
  const newId = newClothingId();
  const image = source.imagePath ? await copyItemImage(source.imagePath, newId) : null;
  try {
    return await createItem({
      id: newId,
      input: { ...source, name: `${source.name} (copy)` },
      source: source.source,
      aiGenerated: source.aiGenerated,
      inferredFields: source.inferredFields,
      editedFields: [...new Set([...source.editedFields, "name"])],
      rawImport: (await getRawImport(id)) ?? undefined,
      image: image
        ? {
            imagePath: image.imagePath,
            originalFilename: source.originalFilename,
            imageHash: source.imageHash,
            imageMime: source.imageMime,
            imageSize: source.imageSize,
            imageWidth: image.width,
            imageHeight: image.height,
          }
        : undefined,
    });
  } catch (e) {
    await deleteItemImage(newId, image?.imagePath ?? null);
    throw e;
  }
}

export interface ReplaceImageResult {
  item: ClothingItem;
  duplicateOf: { id: string; name: string } | null;
}

export async function replaceItemImage(id: string, filename: string, data: Uint8Array, mime?: string | null): Promise<ReplaceImageResult> {
  const item = await getItem(id);
  if (!item) throw new NotFoundError("Clothing item not found.");
  const check = validateImage(data, filename, mime);
  if (!check.ok || !check.ext || !check.mime) throw new ValidationError(check.error ?? "Invalid image.");
  const hash = sha256(data);
  const dup = (await findItemsByHashes([hash])).get(hash);
  // saveItemImage also removes the previous file if its extension differs.
  const stored = await saveItemImage(id, data, check.ext);
  const updated = await updateItemImage(id, {
    imagePath: stored.imagePath,
    originalFilename: sanitizeFilename(filename),
    imageHash: hash,
    imageMime: check.mime,
    imageSize: data.length,
    imageWidth: stored.width,
    imageHeight: stored.height,
  });
  return { item: updated, duplicateOf: dup && dup.id !== id ? dup : null };
}

/** Danger zone: remove every item, outfit and image. */
export async function wipeWardrobe(): Promise<void> {
  await prisma.$transaction([prisma.outfitItem.deleteMany({}), prisma.outfit.deleteMany({}), prisma.clothingItem.deleteMany({})]);
  for (const dir of [thumbsDir(), imagesDir(), stagingDir()]) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  await fs.mkdir(thumbsDir(), { recursive: true });
}
