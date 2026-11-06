import { Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough, strFromU8, strToU8 } from "fflate";
import { BACKUP_FORMAT, BACKUP_VERSION, backupDocumentSchema, type BackupDocument } from "@/lib/backup/format";
import type { OutfitRole } from "@/lib/constants/vocab";
import { sniffImageType } from "@/lib/images/validate";
import { itemsToCsv } from "@/lib/export/csv";
import { CLAUDE_SCHEMA_VERSION, clothingItemInputSchema, inputToClaudeItem } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";
import { randomToken } from "./ids";
import { deleteItemFiles, imageFile, imagesDir, isSafeStoredName, storeItemImage, thumbsDir } from "./images";
import { buildRow, insertRow, listItems, rowToInput, rowToItem, type ClothingRow } from "./items";
import { joinPath, type Services } from "./services";

/**
 * wardrobe-backup.zip — same layout as the web app's backups, so data moves both ways:
 *   database.json  all items + outfits (human-readable)
 *   images/<file>  original photos (items[].image.path)
 */

const CHUNK = 512 * 1024;
const MAX_ENTRY_BYTES = 60 * 1024 * 1024;

export function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

export async function buildBackupDocument(svc: Services): Promise<BackupDocument> {
  const rows = await svc.db.all<ClothingRow>("SELECT * FROM ClothingItem ORDER BY createdAt ASC");
  const outfits = await svc.db.all<{ id: string; name: string; description: string | null; occasion: string | null; season: string | null; style: string | null; explanation: string | null; source: string; createdAt: string }>(
    "SELECT id,name,description,occasion,season,style,explanation,source,createdAt FROM Outfit ORDER BY createdAt ASC",
  );
  const refs = await svc.db.all<{ outfitId: string; clothingItemId: string; role: string; position: number }>(
    "SELECT outfitId, clothingItemId, role, position FROM OutfitItem ORDER BY position ASC",
  );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    items: rows.map((row) => {
      const item = rowToItem(row);
      return {
        id: row.id,
        metadata: rowToInput(row),
        image: row.imagePath
          ? { path: row.imagePath, originalFilename: row.originalFilename, hash: row.imageHash, mime: row.imageMime, size: row.imageSize, width: row.imageWidth, height: row.imageHeight }
          : null,
        source: row.source,
        aiGenerated: item.aiGenerated,
        inferredFields: item.inferredFields,
        editedFields: item.editedFields,
        rawImport: row.rawImport,
        createdAt: row.createdAt,
      };
    }),
    outfits: outfits.map((o) => ({
      ...o,
      items: refs.filter((r) => r.outfitId === o.id).map((r) => ({ clothingItemId: r.clothingItemId, role: r.role as OutfitRole, position: r.position })),
    })),
  };
}

/** Write a backup zip to the cache folder and return its path. `images` = photos only. */
export async function createBackupZip(svc: Services, kind: "full" | "images" = "full"): Promise<string> {
  const dir = joinPath(svc.cacheRoot, "exports");
  await svc.files.ensureDir(dir);
  const path = joinPath(dir, `wardrobe-${kind === "full" ? "backup" : "images"}-${stamp()}.zip`);
  const writer = svc.files.openWriter(path);
  let failed: unknown = null;
  const zip = new Zip((err, chunk) => {
    if (err) failed = err;
    else writer.write(chunk);
  });
  try {
    const doc = await buildBackupDocument(svc);
    if (kind === "full") {
      const json = new ZipDeflate("database.json", { level: 6 });
      zip.add(json);
      json.push(strToU8(JSON.stringify(doc, null, 2)), true);
      const readme = new ZipDeflate("README.txt", { level: 6 });
      zip.add(readme);
      readme.push(strToU8("Wardrobe backup\n\ndatabase.json  all clothing items and outfits\nimages/        original photos (items[].image.path)\n\nRestore in the app: Settings → Restore backup.\n"), true);
    }
    for (const item of doc.items) {
      const name = item.image?.path;
      const file = name ? imageFile(svc, name) : null;
      if (!name || !file || !(await svc.files.exists(file))) continue;
      const entry = new ZipPassThrough(`images/${name}`);
      zip.add(entry);
      entry.push(await svc.files.readBytes(file), true);
      if (failed) throw failed;
    }
    zip.end();
    if (failed) throw failed;
  } finally {
    writer.close();
  }
  return path;
}

async function writeExport(svc: Services, name: string, text: string): Promise<string> {
  const dir = joinPath(svc.cacheRoot, "exports");
  await svc.files.ensureDir(dir);
  const path = joinPath(dir, name);
  await svc.files.writeText(path, text);
  return path;
}

/** Items in the Claude schema (plus IDs), human-readable. */
export async function exportWardrobeJson(svc: Services): Promise<string> {
  const items = await listItems(svc.db);
  const doc = {
    schemaVersion: CLAUDE_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    items: items.map((item) => ({
      id: item.id,
      ...inputToClaudeItem(item, { image: item.imagePath, inferredFields: item.inferredFields }),
      source: item.source,
      editedFields: item.editedFields,
      createdAt: item.createdAt,
    })),
  };
  return writeExport(svc, `wardrobe-items-${stamp()}.json`, JSON.stringify(doc, null, 2));
}

export async function exportCsv(svc: Services): Promise<string> {
  return writeExport(svc, `wardrobe-items-${stamp()}.csv`, "﻿" + itemsToCsv(await listItems(svc.db)));
}

// ---------------------------------------------------------------------------
// Restore

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

const fail = (errors: string[]): RestoreResult => ({ ok: false, itemsRestored: 0, itemsSkipped: 0, outfitsRestored: 0, outfitsSkipped: 0, missingImages: [], errors });

/** Stream-extract database.json and images/* from a backup zip (or read a bare database.json). */
async function extractBackup(svc: Services, source: string, into: string): Promise<{ json: string | null; images: Map<string, string>; error: string | null }> {
  const images = new Map<string, string>();
  await svc.files.ensureDir(into);
  const reader = svc.files.openReader(source);
  try {
    const head = reader.read(Math.min(4, reader.size));
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    if (!isZip) {
      reader.close();
      return { json: await svc.files.readText(source), images, error: null };
    }
    const jsonChunks: Uint8Array[] = [];
    let error: string | null = null;
    const writers: { close(): void }[] = [];
    const unzip = new Unzip((file) => {
      const isJson = file.name === "database.json";
      const imgName = file.name.startsWith("images/") ? file.name.slice(7) : null;
      if (!isJson && !(imgName && isSafeStoredName(imgName))) return; // ignore anything else, never trust paths
      let bytes = 0;
      if (isJson) {
        file.ondata = (err, chunk) => {
          if (err) error = String(err);
          else jsonChunks.push(chunk);
        };
      } else {
        const target = joinPath(into, imgName!);
        const writer = svc.files.openWriter(target);
        writers.push(writer);
        images.set(imgName!, target);
        file.ondata = (err, chunk) => {
          if (err) {
            error = String(err);
            return;
          }
          bytes += chunk.length;
          if (bytes > MAX_ENTRY_BYTES) {
            error = `Archive entry too large: ${file.name}`;
            return;
          }
          writer.write(chunk);
        };
      }
      file.start();
    });
    unzip.register(UnzipInflate);
    unzip.push(head, false);
    let read = head.length;
    while (read < reader.size) {
      const chunk = reader.read(Math.min(CHUNK, reader.size - read));
      read += chunk.length;
      unzip.push(chunk, read >= reader.size);
      if (error) break;
    }
    for (const w of writers) w.close();
    if (error) return { json: null, images, error };
    if (!jsonChunks.length) return { json: null, images, error: "The archive has no database.json." };
    const total = jsonChunks.reduce((n, c) => n + c.length, 0);
    const all = new Uint8Array(total);
    let off = 0;
    for (const c of jsonChunks) {
      all.set(c, off);
      off += c.length;
    }
    return { json: strFromU8(all), images, error: null };
  } catch (e) {
    return { json: null, images, error: `Could not read the backup: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    try {
      reader.close();
    } catch {
      // already closed
    }
  }
}

/**
 * Restore a backup made by this app or by the web app.
 *  merge:   add items/outfits whose IDs aren't here yet
 *  replace: wipe the wardrobe, then restore exactly the backup
 * Everything is validated first; photos are staged and only moved in after the DB transaction.
 */
export async function restoreBackup(svc: Services, source: string, mode: RestoreMode): Promise<RestoreResult> {
  const tmp = joinPath(svc.cacheRoot, "restore", randomToken(svc, 10));
  await svc.files.ensureDir(tmp);
  try {
    // Work on a private copy: a picked file is a content:// link, and chunked reads on those
    // fail in expo-file-system ("bad file descriptor"), while a plain copy streams reliably.
    const local = joinPath(tmp, "backup-source");
    try {
      await svc.files.copy(source, local);
    } catch (e) {
      return fail([`Could not read the backup file: ${e instanceof Error ? e.message : String(e)}`]);
    }
    const { json, images, error } = await extractBackup(svc, local, joinPath(tmp, "files"));
    if (error || json === null) return fail([error ?? "Empty backup."]);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (e) {
      return fail([`database.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`]);
    }
    const docResult = backupDocumentSchema.safeParse(parsed);
    if (!docResult.success) return fail(formatZodIssues(docResult.error).slice(0, 20));
    const doc = docResult.data;

    const existingIds = new Set(mode === "merge" ? (await svc.db.all<{ id: string }>("SELECT id FROM ClothingItem")).map((r) => r.id) : []);
    const existingOutfits = new Set(mode === "merge" ? (await svc.db.all<{ id: string }>("SELECT id FROM Outfit")).map((r) => r.id) : []);

    const problems: string[] = [];
    const missingImages: string[] = [];
    const rows: ClothingRow[] = [];
    const photos: { rowIndex: number; staged: string; ext: "jpg" | "png" | "webp"; hash: string }[] = [];
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
      const row = buildRow(svc, {
        id: item.id,
        input: meta.data,
        source: item.source,
        aiGenerated: item.aiGenerated,
        inferredFields: item.inferredFields,
        editedFields: item.editedFields,
        rawImportText: item.rawImport ?? null,
        createdAt: item.createdAt ?? undefined,
      });
      const name = item.image?.path;
      if (name) {
        const staged = images.get(name);
        const bytes = staged && (await svc.files.exists(staged)) ? await svc.files.readBytes(staged) : null;
        const ext = bytes ? sniffImageType(bytes) : null;
        if (!bytes || !ext || !staged) missingImages.push(name);
        else {
          photos.push({ rowIndex: rows.length, staged, ext, hash: await svc.sha256(bytes) });
          Object.assign(row, {
            originalFilename: item.image?.originalFilename ?? null,
            imageHash: null, // set after the photo is stored
            imageMime: ext === "jpg" ? "image/jpeg" : `image/${ext}`,
            imageSize: bytes.length,
          });
        }
      }
      rows.push(row);
    }
    if (problems.length) return fail(problems.slice(0, 30));

    // Store photos first (new unique file names), then the transaction.
    const stored: string[] = [];
    try {
      for (const p of photos) {
        const s = await storeItemImage(svc, rows[p.rowIndex].id, p.staged, p.ext, p.hash);
        stored.push(s.imagePath);
        Object.assign(rows[p.rowIndex], { imagePath: s.imagePath, imageHash: p.hash, imageWidth: s.width, imageHeight: s.height });
      }
    } catch (e) {
      for (const name of stored) await removeStoredImage(svc, name);
      return fail([`Could not save photos: ${e instanceof Error ? e.message : String(e)}. Nothing was changed.`]);
    }

    const finalIds = new Set([...existingIds, ...rows.map((r) => r.id)]);
    const outfits = doc.outfits.filter((o) => !existingOutfits.has(o.id));
    let previousImages: string[] = [];
    try {
      await svc.db.transaction(async (tx) => {
        if (mode === "replace") {
          previousImages = (await tx.all<{ imagePath: string | null }>("SELECT imagePath FROM ClothingItem")).map((r) => r.imagePath).filter((p): p is string => Boolean(p));
          await tx.run("DELETE FROM OutfitItem");
          await tx.run("DELETE FROM Outfit");
          await tx.run("DELETE FROM ClothingItem");
        }
        for (const row of rows) await insertRow(tx, row);
        for (const o of outfits) {
          const created = o.createdAt ?? new Date().toISOString();
          await tx.run(
            "INSERT INTO Outfit (id,name,description,occasion,season,style,explanation,source,rawImport,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,NULL,?,?)",
            [o.id, o.name, o.description ?? null, o.occasion ?? null, o.season ?? null, o.style ?? null, o.explanation ?? null, o.source, created, created],
          );
          const used = new Set<string>();
          for (const ref of o.items) {
            if (!finalIds.has(ref.clothingItemId) || used.has(ref.clothingItemId)) continue;
            used.add(ref.clothingItemId);
            await tx.run("INSERT INTO OutfitItem (id,outfitId,clothingItemId,role,position) VALUES (?,?,?,?,?)", [
              `oi_${randomToken(svc, 12)}`, o.id, ref.clothingItemId, ref.role, ref.position,
            ]);
          }
        }
      });
    } catch (e) {
      for (const name of stored) await removeStoredImage(svc, name);
      return fail([`Restore failed, nothing was changed: ${e instanceof Error ? e.message : String(e)}`]);
    }
    if (mode === "replace") for (const name of previousImages) if (!stored.includes(name)) await removeStoredImage(svc, name);

    return { ok: true, itemsRestored: rows.length, itemsSkipped, outfitsRestored: outfits.length, outfitsSkipped: doc.outfits.length - outfits.length, missingImages, errors: [] };
  } finally {
    await svc.files.removeDir(tmp).catch(() => undefined);
  }
}

async function removeStoredImage(svc: Services, imagePath: string) {
  await deleteItemFiles(svc, imagePath);
}

/** Danger zone: remove every item, outfit and photo. */
export async function wipeWardrobe(svc: Services): Promise<void> {
  await svc.db.transaction(async (tx) => {
    await tx.run("DELETE FROM OutfitItem");
    await tx.run("DELETE FROM Outfit");
    await tx.run("DELETE FROM ClothingItem");
  });
  await svc.files.removeDir(imagesDir(svc));
  await svc.files.removeDir(thumbsDir(svc));
  await svc.files.removeDir(joinPath(svc.cacheRoot, "staging"));
}

export async function storageStats(svc: Services) {
  const count = async (dir: string) => {
    let bytes = 0;
    const names = await svc.files.list(dir);
    for (const n of names) bytes += await svc.files.size(joinPath(dir, n)).catch(() => 0);
    return { files: names.length, bytes };
  };
  const [images, thumbs] = await Promise.all([count(imagesDir(svc)), count(thumbsDir(svc))]);
  return { images, thumbs };
}
