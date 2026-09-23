import { promises as fs } from "node:fs";
import path from "node:path";
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from "fflate";
import { prisma } from "@/lib/db/client";
import { rowToInput, rowToItem } from "@/lib/db/mappers";
import { readItemImage } from "@/lib/images/storage";
import { databaseFilePath, tmpDir } from "@/lib/config";
import { randomToken } from "@/lib/db/ids";
import type { OutfitRole } from "@/lib/constants/vocab";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupDocument } from "./format";

/** Build the human-readable database.json document for a full backup. */
export async function buildBackupDocument(): Promise<BackupDocument> {
  const [rows, outfits] = await Promise.all([
    prisma.clothingItem.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.outfit.findMany({ include: { items: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "asc" } }),
  ]);
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
          ? {
              path: row.imagePath,
              originalFilename: row.originalFilename,
              hash: row.imageHash,
              mime: row.imageMime,
              size: row.imageSize,
              width: row.imageWidth,
              height: row.imageHeight,
            }
          : null,
        source: row.source,
        aiGenerated: row.aiGenerated,
        inferredFields: item.inferredFields,
        editedFields: item.editedFields,
        rawImport: row.rawImport,
        createdAt: item.createdAt,
      };
    }),
    outfits: outfits.map((o) => ({
      id: o.id,
      name: o.name,
      description: o.description,
      occasion: o.occasion,
      season: o.season,
      style: o.style,
      explanation: o.explanation,
      source: o.source,
      createdAt: o.createdAt.toISOString(),
      items: o.items.map((i) => ({ clothingItemId: i.clothingItemId, role: i.role as OutfitRole, position: i.position })),
    })),
  };
}

const README = `Wardrobe backup
===============

database.json  All clothing items and outfits (plain JSON, human-readable).
images/        The original clothing photos. items[].image.path is the file name.

Restore it from the app: Settings → Restore backup.
`;

/**
 * Stream a zip archive. Images are stored without recompression (they are already compressed).
 * `mode: "images"` exports only the photos.
 */
export function createBackupStream(mode: "full" | "images" = "full"): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        controller.enqueue(chunk);
        if (final) controller.close();
      });
      try {
        const addText = (name: string, text: string) => {
          const entry = new ZipDeflate(name, { level: 6 });
          zip.add(entry);
          entry.push(strToU8(text), true);
        };
        const doc = await buildBackupDocument();
        if (mode === "full") {
          addText("database.json", JSON.stringify(doc, null, 2));
          addText("README.txt", README);
        }
        for (const item of doc.items) {
          const imagePath = item.image?.path;
          if (!imagePath) continue;
          const data = await readItemImage(imagePath);
          if (!data) continue;
          const entry = new ZipPassThrough(`images/${imagePath}`);
          zip.add(entry);
          entry.push(new Uint8Array(data), true);
        }
        zip.end();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

/** Consistent snapshot of the SQLite file (VACUUM INTO), returned as bytes. */
export async function snapshotDatabase(): Promise<Buffer> {
  const dbPath = databaseFilePath();
  if (!dbPath) throw new Error("DATABASE_URL is not a local SQLite file.");
  await fs.mkdir(tmpDir(), { recursive: true });
  const target = path.join(tmpDir(), `snapshot-${randomToken(8)}.db`);
  try {
    await prisma.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
    return await fs.readFile(target);
  } finally {
    await fs.rm(target, { force: true });
  }
}

export function backupFilename(kind: string, ext: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `wardrobe-${kind}-${stamp}.${ext}`;
}
