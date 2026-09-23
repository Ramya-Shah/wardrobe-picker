import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { imagesDir, thumbsDir, THUMBNAIL_WIDTH } from "@/lib/config";
import { randomToken, SAFE_ID_PATTERN } from "@/lib/db/ids";
import type { ImageExtension } from "./validate";

/** Stored image file names are always "<id>.<ext>" — nothing user-controlled reaches the filesystem. */
const STORED_NAME = /^[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/;

export interface StoredImageInfo {
  imagePath: string;
  width: number | null;
  height: number | null;
}

export function isSafeStoredName(name: string): boolean {
  return STORED_NAME.test(name);
}

/** Resolve a stored image name to an absolute path inside data/images, or null if unsafe. */
export function resolveImageFile(imagePath: string): string | null {
  if (!isSafeStoredName(imagePath)) return null;
  const dir = imagesDir();
  const full = path.resolve(dir, imagePath);
  if (path.dirname(full) !== dir) return null;
  return full;
}

export function thumbnailPath(id: string): string | null {
  if (!SAFE_ID_PATTERN.test(id)) return null;
  return path.join(thumbsDir(), `${id}.webp`);
}

async function ensureDirs() {
  await fs.mkdir(imagesDir(), { recursive: true });
  await fs.mkdir(thumbsDir(), { recursive: true });
}

/** Write via temp file + rename so a crash never leaves a half-written image. */
async function atomicWrite(target: string, data: Uint8Array) {
  const tmp = `${target}.${randomToken(6)}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, target);
}

export async function createThumbnail(source: Uint8Array | string, id: string): Promise<void> {
  const target = thumbnailPath(id);
  if (!target) throw new Error("Invalid item id");
  await ensureDirs();
  const data = await sharp(source, { failOn: "none" })
    .rotate() // respect EXIF orientation from phone cameras
    .resize({ width: THUMBNAIL_WIDTH, height: Math.round(THUMBNAIL_WIDTH * 1.5), fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  await atomicWrite(target, data);
}

/**
 * Store the image for an item as data/images/<id>.<ext> and create its thumbnail.
 * Replaces any previous image of that item (even with a different extension).
 */
export async function saveItemImage(id: string, data: Uint8Array, ext: ImageExtension): Promise<StoredImageInfo> {
  if (!SAFE_ID_PATTERN.test(id)) throw new Error("Invalid item id");
  await ensureDirs();
  const imagePath = `${id}.${ext}`;
  const target = resolveImageFile(imagePath);
  if (!target) throw new Error("Invalid image path");

  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(data, { failOn: "none" }).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    width = (rotated ? meta.height : meta.width) ?? null;
    height = (rotated ? meta.width : meta.height) ?? null;
  } catch {
    throw new Error("The image could not be decoded.");
  }

  await atomicWrite(target, data);
  // Remove stale files of this item with another extension.
  for (const other of ["jpg", "jpeg", "png", "webp"]) {
    if (other === ext) continue;
    const stale = resolveImageFile(`${id}.${other}`);
    if (stale) await fs.rm(stale, { force: true });
  }
  await createThumbnail(data, id);
  return { imagePath, width, height };
}

export async function copyItemImage(fromImagePath: string, toId: string): Promise<StoredImageInfo | null> {
  const src = resolveImageFile(fromImagePath);
  if (!src) return null;
  const raw = path.extname(fromImagePath).slice(1).toLowerCase();
  const ext: ImageExtension = raw === "png" ? "png" : raw === "webp" ? "webp" : "jpg";
  const data = await fs.readFile(src);
  return saveItemImage(toId, data, ext);
}

export async function deleteItemImage(id: string, imagePath: string | null): Promise<void> {
  if (imagePath) {
    const file = resolveImageFile(imagePath);
    if (file) await fs.rm(file, { force: true });
  }
  const thumb = thumbnailPath(id);
  if (thumb) await fs.rm(thumb, { force: true });
}

export async function readItemImage(imagePath: string): Promise<Buffer | null> {
  const file = resolveImageFile(imagePath);
  if (!file) return null;
  try {
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

/** Read (or lazily regenerate) the thumbnail for an item. */
export async function readThumbnail(id: string, imagePath: string): Promise<Buffer | null> {
  const thumb = thumbnailPath(id);
  if (!thumb) return null;
  try {
    return await fs.readFile(thumb);
  } catch {
    const original = resolveImageFile(imagePath);
    if (!original) return null;
    try {
      await createThumbnail(original, id);
      return await fs.readFile(thumb);
    } catch {
      return null;
    }
  }
}

async function dirSize(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  let entries: import("node:fs").Dirent[] = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return { files, bytes };
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try {
      const stat = await fs.stat(path.join(dir, entry.name));
      files++;
      bytes += stat.size;
    } catch {
      // ignore files that disappear while counting
    }
  }
  return { files, bytes };
}

export async function imageStorageStats() {
  const [images, thumbs] = await Promise.all([dirSize(imagesDir()), dirSize(thumbsDir())]);
  return { images, thumbs };
}
