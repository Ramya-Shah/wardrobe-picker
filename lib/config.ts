import path from "node:path";

/**
 * Filesystem locations. Resolved lazily so tests (and power users) can point the app
 * at another directory through WARDROBE_DATA_DIR.
 */
export function dataDir(): string {
  return path.resolve(process.env.WARDROBE_DATA_DIR || path.join(process.cwd(), "data"));
}

export function imagesDir(): string {
  return path.join(dataDir(), "images");
}

export function thumbsDir(): string {
  return path.join(imagesDir(), "thumbs");
}

export function stagingDir(): string {
  return path.join(dataDir(), "staging");
}

export function tmpDir(): string {
  return path.join(dataDir(), "tmp");
}

/** Absolute path of the SQLite file from DATABASE_URL ("file:../data/wardrobe.db" is relative to prisma/). */
export function databaseFilePath(): string | null {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return null;
  const p = url.slice("file:".length).split("?")[0];
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), "prisma", p);
}

export { MAX_IMAGE_BYTES, THUMBNAIL_WIDTH } from "@/lib/constants/limits";
