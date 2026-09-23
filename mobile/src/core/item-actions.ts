import { newClothingId } from "./ids";
import { createStagingDir, deleteItemFiles, imageFile, removeStagingDir, stageImage, storeItemImage } from "./images";
import { createItem, findItemsByHashes, getItem, getRawImport, setItemImage } from "./items";
import type { Services } from "./services";
import type { ClothingItem } from "@/lib/types";

/** Copy an item (metadata + its own copy of the photo). The name is marked as edited. */
export async function duplicateItem(svc: Services, id: string): Promise<ClothingItem> {
  const source = await getItem(svc.db, id);
  if (!source) throw new Error("Clothing item not found.");
  const newId = newClothingId(svc);
  const src = source.imagePath ? imageFile(svc, source.imagePath) : null;
  const ext = source.imagePath?.split(".").pop() as "jpg" | "png" | "webp" | undefined;
  const stored = src && ext && source.imageHash ? await storeItemImage(svc, newId, src, ext, source.imageHash) : null;
  try {
    return await createItem(svc, {
      id: newId,
      input: { ...source, name: `${source.name} (copy)` },
      source: source.source,
      aiGenerated: source.aiGenerated,
      inferredFields: source.inferredFields,
      editedFields: [...new Set([...source.editedFields, "name"])],
      rawImportText: await getRawImport(svc.db, id),
      image: stored
        ? { imagePath: stored.imagePath, originalFilename: source.originalFilename, imageHash: source.imageHash, imageMime: source.imageMime, imageSize: source.imageSize, imageWidth: stored.width, imageHeight: stored.height }
        : undefined,
    });
  } catch (e) {
    if (stored) await deleteItemFiles(svc, stored.imagePath);
    throw e;
  }
}

/** Replace an item's photo. Returns the other item that already uses this photo, if any. */
export async function replaceItemImage(
  svc: Services,
  id: string,
  picked: { uri: string; name: string; mimeType?: string | null },
): Promise<{ duplicateOf: { id: string; name: string } | null }> {
  const item = await getItem(svc.db, id);
  if (!item) throw new Error("Clothing item not found.");
  const dir = await createStagingDir(svc);
  try {
    const staged = await stageImage(svc, dir, picked);
    const dup = (await findItemsByHashes(svc.db, [staged.hash])).get(staged.hash);
    const stored = await storeItemImage(svc, id, staged.path, staged.ext, staged.hash);
    await setItemImage(svc.db, id, {
      imagePath: stored.imagePath,
      originalFilename: staged.originalName,
      imageHash: staged.hash,
      imageMime: staged.mime,
      imageSize: staged.size,
      imageWidth: stored.width,
      imageHeight: stored.height,
    });
    if (item.imagePath && item.imagePath !== stored.imagePath) await deleteItemFiles(svc, item.imagePath);
    return { duplicateOf: dup && dup.id !== id ? dup : null };
  } finally {
    await removeStagingDir(svc, dir);
  }
}
