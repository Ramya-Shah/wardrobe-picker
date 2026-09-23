import { THUMBNAIL_WIDTH } from "@/lib/constants/limits";
import { sanitizeFilename, validateImage, type ImageExtension } from "@/lib/images/validate";
import { randomToken } from "./ids";
import { joinPath, type Services } from "./services";

/**
 * Photo storage on the phone:
 *   <dataRoot>/images/<id>-<hash8>.<ext>   original photo
 *   <dataRoot>/thumbs/<id>-<hash8>.webp    ~480px thumbnail for grids
 * The hash in the name changes when a photo is replaced, so image caches never show a stale photo.
 */

const STORED_NAME = /^[A-Za-z0-9_-]{1,64}\.(jpg|jpeg|png|webp)$/;

export const imagesDir = (svc: Services) => joinPath(svc.dataRoot, "images");
export const thumbsDir = (svc: Services) => joinPath(svc.dataRoot, "thumbs");

export function isSafeStoredName(name: string): boolean {
  return STORED_NAME.test(name);
}

export function imageFile(svc: Services, imagePath: string): string | null {
  return isSafeStoredName(imagePath) ? joinPath(imagesDir(svc), imagePath) : null;
}

export function thumbFile(svc: Services, imagePath: string): string | null {
  if (!isSafeStoredName(imagePath)) return null;
  return joinPath(thumbsDir(svc), `${imagePath.replace(/\.[a-z]+$/, "")}.webp`);
}

export interface StoredImage {
  imagePath: string;
  width: number | null;
  height: number | null;
}

/** Copy an already-validated image file into the wardrobe and create its thumbnail. */
export async function storeItemImage(
  svc: Services,
  id: string,
  source: string,
  ext: ImageExtension,
  hash: string,
): Promise<StoredImage> {
  await svc.files.ensureDir(imagesDir(svc));
  await svc.files.ensureDir(thumbsDir(svc));
  const imagePath = `${id}-${hash.slice(0, 8)}.${ext}`;
  const target = imageFile(svc, imagePath)!;
  await svc.files.copy(source, target);
  let dims: { width: number; height: number } | null = null;
  try {
    dims = await svc.images.makeThumbnail(target, thumbFile(svc, imagePath)!, THUMBNAIL_WIDTH);
  } catch {
    // A missing thumbnail falls back to the full image in the UI.
  }
  return { imagePath, width: dims?.width ?? null, height: dims?.height ?? null };
}

export async function deleteItemFiles(svc: Services, imagePath: string | null): Promise<void> {
  if (!imagePath) return;
  const img = imageFile(svc, imagePath);
  const thumb = thumbFile(svc, imagePath);
  if (img) await svc.files.remove(img);
  if (thumb) await svc.files.remove(thumb);
}

// ---------------------------------------------------------------------------
// Import staging: photos are validated, normalized and hashed before the preview.

export interface StagedImage {
  key: string;
  /** Sanitized original file name — used for matching with Claude's "image" field. */
  originalName: string;
  path: string;
  hash: string;
  ext: ImageExtension;
  mime: string;
  size: number;
}

export async function createStagingDir(svc: Services): Promise<string> {
  const dir = joinPath(svc.cacheRoot, "staging", randomToken(svc, 12));
  await svc.files.ensureDir(dir);
  return dir;
}

/**
 * Validate and stage one picked photo. Unsupported formats the phone can decode
 * (e.g. HEIC) are converted to JPEG. Throws a user-readable Error if it can't be used.
 */
export async function stageImage(
  svc: Services,
  stagingDir: string,
  source: { uri: string; name: string; mimeType?: string | null },
): Promise<StagedImage> {
  const name = sanitizeFilename(source.name);
  const key = randomToken(svc, 12);
  let bytes = await svc.files.readBytes(source.uri);
  const nameForCheck = /\.(jpe?g|png|webp)$/i.test(name) ? name : `${name}.jpg`;
  let check = validateImage(bytes, nameForCheck, source.mimeType);

  if (!check.ok && !/too large|empty/.test(check.error ?? "")) {
    const converted = joinPath(stagingDir, `${key}-converted.jpg`);
    if (await svc.images.convertToJpeg(source.uri, converted).catch(() => false)) {
      bytes = await svc.files.readBytes(converted);
      check = validateImage(bytes, "converted.jpg", "image/jpeg");
      await svc.files.remove(converted);
    }
  }
  if (!check.ok || !check.ext || !check.mime) throw new Error(`${name}: ${check.error ?? "not a supported image"}`);

  const path = joinPath(stagingDir, `${key}.${check.ext}`);
  await svc.files.writeBytes(path, bytes);
  return { key, originalName: name, path, hash: await svc.sha256(bytes), ext: check.ext, mime: check.mime, size: bytes.length };
}

export async function removeStagingDir(svc: Services, dir: string): Promise<void> {
  await svc.files.removeDir(dir).catch(() => undefined);
}
