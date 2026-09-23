/**
 * Everything the wardrobe core needs from the platform, behind small interfaces.
 * The app wires these to expo-sqlite / expo-file-system / expo-image-manipulator
 * (src/platform/expo-services.ts); tests wire them to node:sqlite and node:fs.
 */

export type SqlValue = string | number | null;

export interface Db {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Run `fn` atomically. Queries inside must go through the `tx` handle. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/** Sequential writer used to stream large files (backup zips) without holding them in memory. */
export interface FileWriter {
  write(bytes: Uint8Array): void;
  close(): void;
}

export interface FileReader {
  readonly size: number;
  read(length: number): Uint8Array;
  close(): void;
}

/** Filesystem access by absolute path/URI. */
export interface FileStore {
  readBytes(path: string): Promise<Uint8Array>;
  readText(path: string): Promise<string>;
  writeBytes(path: string, data: Uint8Array): Promise<void>;
  writeText(path: string, text: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  size(path: string): Promise<number>;
  remove(path: string): Promise<void>;
  removeDir(path: string): Promise<void>;
  ensureDir(path: string): Promise<void>;
  /** File names directly inside a directory ([] if it doesn't exist). */
  list(dir: string): Promise<string[]>;
  move(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /** Create/truncate a file for sequential writing (parent folder must exist). */
  openWriter(path: string): FileWriter;
  openReader(path: string): FileReader;
}

export interface ImageTools {
  /** Write a small WebP/JPEG thumbnail of `source` to `target`; returns the source dimensions. */
  makeThumbnail(source: string, target: string, width: number): Promise<{ width: number; height: number } | null>;
  /** Re-encode an image the app can't store as-is (e.g. HEIC) to JPEG at `target`. */
  convertToJpeg(source: string, target: string): Promise<boolean>;
}

export interface Services {
  db: Db;
  files: FileStore;
  images: ImageTools;
  sha256(bytes: Uint8Array): Promise<string>;
  randomBytes(count: number): Uint8Array;
  /** Root folder for the wardrobe's own files (images/, thumbs/). */
  dataRoot: string;
  /** Scratch space (staging, backups being built). */
  cacheRoot: string;
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, "") : p.replace(/^\/+|\/+$/g, "")))
    .join("/");
}
