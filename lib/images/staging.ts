import { promises as fs } from "node:fs";
import path from "node:path";
import { stagingDir } from "@/lib/config";
import { randomToken } from "@/lib/db/ids";
import { sha256 } from "./hash";
import { sanitizeFilename, validateImage, type ImageExtension } from "./validate";

/**
 * Import staging area (data/staging/<session>/).
 *
 * Images are uploaded one by one before anything is written to the wardrobe, so the
 * server can validate + hash them and report duplicates in the preview. Nothing here
 * is part of the wardrobe until the import is committed.
 */

const TOKEN = /^[a-z0-9]{6,32}$/;
const STAGING_TTL_MS = 24 * 60 * 60 * 1000;

export interface StagedFile {
  key: string;
  originalName: string;
  hash: string;
  mime: string;
  ext: ImageExtension;
  size: number;
}

function sessionPath(sessionId: string): string {
  if (!TOKEN.test(sessionId)) throw new StagingError("Invalid import session.");
  return path.join(stagingDir(), sessionId);
}

export class StagingError extends Error {}

export async function createStagingSession(): Promise<string> {
  await cleanupStaging().catch(() => undefined);
  const id = randomToken(16);
  await fs.mkdir(sessionPath(id), { recursive: true });
  return id;
}

export async function stagingSessionExists(sessionId: string): Promise<boolean> {
  try {
    return (await fs.stat(sessionPath(sessionId))).isDirectory();
  } catch {
    return false;
  }
}

export async function addStagedFile(
  sessionId: string,
  filename: string,
  data: Uint8Array,
  declaredMime?: string | null,
): Promise<StagedFile> {
  const dir = sessionPath(sessionId);
  if (!(await stagingSessionExists(sessionId))) throw new StagingError("Import session expired. Start the import again.");
  const originalName = sanitizeFilename(filename);
  const check = validateImage(data, filename, declaredMime);
  if (!check.ok || !check.ext || !check.mime) throw new StagingError(`${originalName}: ${check.error}`);

  const key = randomToken(12);
  const file: StagedFile = { key, originalName, hash: sha256(data), mime: check.mime, ext: check.ext, size: data.length };
  await fs.writeFile(path.join(dir, `${key}.${check.ext}`), data);
  await fs.writeFile(path.join(dir, `${key}.json`), JSON.stringify(file));
  return file;
}

export async function getStagedFile(sessionId: string, key: string): Promise<{ meta: StagedFile; data: Buffer } | null> {
  if (!TOKEN.test(key)) return null;
  const dir = sessionPath(sessionId);
  try {
    const meta = JSON.parse(await fs.readFile(path.join(dir, `${key}.json`), "utf8")) as StagedFile;
    if (!["jpg", "png", "webp"].includes(meta.ext)) return null;
    const data = await fs.readFile(path.join(dir, `${key}.${meta.ext}`));
    return { meta, data };
  } catch {
    return null;
  }
}

export async function removeStagingSession(sessionId: string): Promise<void> {
  await fs.rm(sessionPath(sessionId), { recursive: true, force: true });
}

/** Remove abandoned staging sessions older than a day. */
export async function cleanupStaging(now = Date.now()): Promise<void> {
  let entries: string[] = [];
  try {
    entries = await fs.readdir(stagingDir());
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!TOKEN.test(entry)) continue;
    const full = path.join(stagingDir(), entry);
    try {
      const stat = await fs.stat(full);
      if (now - stat.mtimeMs > STAGING_TTL_MS) await fs.rm(full, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
