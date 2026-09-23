import { z } from "zod";
import { SAFE_ID_PATTERN } from "@/lib/constants/limits";
import { outfitRoleSchema } from "@/lib/validation/outfit";
import { textList } from "@/lib/validation/primitives";

/**
 * wardrobe-backup.zip layout:
 *   database.json   — every item and outfit (human-readable, this file)
 *   images/<file>   — original clothing photos, referenced by items[].imagePath
 *   README.txt
 */
export const BACKUP_FORMAT = "wardrobe-backup";
export const BACKUP_VERSION = 1;

const safeId = z.string().regex(SAFE_ID_PATTERN, "invalid id");
const isoDate = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), "invalid date")
  .nullish();

export const backupItemSchema = z.object({
  id: safeId,
  metadata: z.unknown(),
  image: z
    .object({
      path: z.string().max(100).nullish(),
      originalFilename: z.string().max(255).nullish(),
      hash: z.string().max(128).nullish(),
      mime: z.string().max(50).nullish(),
      size: z.number().int().nonnegative().nullish(),
      width: z.number().int().nonnegative().nullish(),
      height: z.number().int().nonnegative().nullish(),
    })
    .nullish(),
  source: z.string().max(50).default("restore"),
  aiGenerated: z.boolean().default(false),
  inferredFields: textList,
  editedFields: z.array(z.string().max(50)).max(50).default([]),
  rawImport: z.string().max(200_000).nullish(),
  createdAt: isoDate,
});

export const backupOutfitSchema = z.object({
  id: safeId,
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullish(),
  occasion: z.string().max(500).nullish(),
  season: z.string().max(500).nullish(),
  style: z.string().max(500).nullish(),
  explanation: z.string().max(5000).nullish(),
  source: z.string().max(50).default("restore"),
  createdAt: isoDate,
  items: z.array(z.object({ clothingItemId: safeId, role: outfitRoleSchema, position: z.number().int().default(0) })).max(50),
});

export const backupDocumentSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string().optional(),
  items: z.array(backupItemSchema).max(100_000),
  outfits: z.array(backupOutfitSchema).max(100_000).default([]),
});

export type BackupDocument = z.infer<typeof backupDocumentSchema>;
export type BackupItem = z.infer<typeof backupItemSchema>;
export type BackupOutfit = z.infer<typeof backupOutfitSchema>;
