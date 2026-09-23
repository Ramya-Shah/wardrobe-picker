import { MAX_IMAGE_BYTES } from "@/lib/constants/limits";

// Pure (no Node APIs): shared with the mobile app. Hashing lives in ./hash.ts.

export const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export type ImageExtension = "jpg" | "png" | "webp";
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const MIME_BY_EXT: Record<ImageExtension, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export function mimeForExtension(ext: string): string | null {
  const e = ext.toLowerCase() === "jpeg" ? "jpg" : ext.toLowerCase();
  return MIME_BY_EXT[e as ImageExtension] ?? null;
}

/** Detect the real image type from magic bytes — never trust the filename or browser MIME alone. */
export function sniffImageType(buf: Uint8Array): ImageExtension | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  )
    return "png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return "webp";
  return null;
}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

/**
 * Make a user-supplied filename safe to display/log: strip directories, control characters
 * and anything outside a conservative character set. Never used to build storage paths.
 */
export function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9 ._()\-]/g, "_")
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 200);
  return cleaned || "image";
}

export interface ImageValidation {
  ok: boolean;
  ext: ImageExtension | null;
  mime: string | null;
  error: string | null;
}

export function validateImage(buf: Uint8Array, filename: string, declaredMime?: string | null): ImageValidation {
  const fail = (error: string): ImageValidation => ({ ok: false, ext: null, mime: null, error });
  const ext = extensionOf(filename);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return fail(`Unsupported file type ".${ext || "?"}". Use JPG, PNG or WebP.`);
  }
  if (buf.length === 0) return fail("The file is empty.");
  if (buf.length > MAX_IMAGE_BYTES) {
    return fail(`The file is too large (${(buf.length / 1024 / 1024).toFixed(1)} MB, max ${MAX_IMAGE_BYTES / 1024 / 1024} MB).`);
  }
  if (declaredMime && declaredMime !== "application/octet-stream" && !(ALLOWED_MIME_TYPES as readonly string[]).includes(declaredMime)) {
    return fail(`Unsupported MIME type "${declaredMime}". Use JPG, PNG or WebP.`);
  }
  const sniffed = sniffImageType(buf);
  if (!sniffed) return fail("The file content is not a valid JPG, PNG or WebP image.");
  return { ok: true, ext: sniffed, mime: MIME_BY_EXT[sniffed], error: null };
}

