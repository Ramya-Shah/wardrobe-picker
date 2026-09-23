import type { Prisma } from "@prisma/client";
import { EDITABLE_FIELDS } from "@/lib/constants/fields";
import { CLAUDE_SCHEMA_VERSION } from "@/lib/validation/clothing";
import type { ClothingItem, ClothingItemInput, EditableField } from "@/lib/types";
import { prisma } from "./client";
import { newClothingId } from "./ids";
import { inputToRowData, rowToInput, rowToItem } from "./mappers";

type Db = Prisma.TransactionClient | typeof prisma;

export interface ImageFields {
  imagePath: string | null;
  originalFilename: string | null;
  imageHash: string | null;
  imageMime: string | null;
  imageSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

export interface CreateItemParams {
  id?: string;
  input: ClothingItemInput;
  image?: Partial<ImageFields>;
  source: string;
  aiGenerated: boolean;
  inferredFields?: string[];
  editedFields?: string[];
  rawImport?: unknown;
  createdAt?: Date;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Which editable fields differ between two metadata objects. */
export function changedFields(before: ClothingItemInput, after: Partial<ClothingItemInput>): EditableField[] {
  const changed: EditableField[] = [];
  for (const key of EDITABLE_FIELDS) {
    if (!(key in after)) continue;
    if (!sameValue(before[key], after[key])) changed.push(key);
  }
  return changed;
}

/**
 * Merge freshly imported metadata into an existing item without clobbering manual corrections:
 * any field listed in `editedFields` keeps the user's value.
 */
export function mergePreservingEdits(
  existing: ClothingItemInput,
  imported: ClothingItemInput,
  editedFields: string[],
): ClothingItemInput {
  const merged = { ...imported } as Record<EditableField, unknown>;
  for (const key of EDITABLE_FIELDS) {
    if (editedFields.includes(key)) merged[key] = existing[key];
  }
  // Notes are personal: never replace existing notes with imported ones.
  if (existing.userNotes && !imported.userNotes) merged.userNotes = existing.userNotes;
  return merged as unknown as ClothingItemInput;
}

export async function getItem(id: string): Promise<ClothingItem | null> {
  const row = await prisma.clothingItem.findUnique({ where: { id }, omit: { rawImport: true } });
  return row ? rowToItem({ ...row, rawImport: null }) : null;
}

export async function getRawImport(id: string): Promise<string | null> {
  const row = await prisma.clothingItem.findUnique({ where: { id }, select: { rawImport: true } });
  return row?.rawImport ?? null;
}

export async function getItemsByIds(ids: string[]): Promise<ClothingItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.clothingItem.findMany({ where: { id: { in: ids } }, omit: { rawImport: true } });
  return rows.map((r) => rowToItem({ ...r, rawImport: null }));
}

/** All items (without the raw import blob). Fine for thousands of rows; used by search and exports. */
export async function listAllItems(where: Prisma.ClothingItemWhereInput = {}): Promise<ClothingItem[]> {
  const rows = await prisma.clothingItem.findMany({ where, omit: { rawImport: true }, orderBy: { createdAt: "desc" } });
  return rows.map((r) => rowToItem({ ...r, rawImport: null }));
}

export async function recentItems(limit = 10): Promise<ClothingItem[]> {
  const rows = await prisma.clothingItem.findMany({ omit: { rawImport: true }, orderBy: { createdAt: "desc" }, take: limit });
  return rows.map((r) => rowToItem({ ...r, rawImport: null }));
}

export async function countItems(): Promise<number> {
  return prisma.clothingItem.count();
}

export async function countByCategory(): Promise<Record<string, number>> {
  const groups = await prisma.clothingItem.groupBy({ by: ["category"], _count: { _all: true } });
  return Object.fromEntries(groups.map((g) => [g.category, g._count._all]));
}

export async function findItemsByHashes(hashes: string[]): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();
  if (hashes.length === 0) return map;
  const rows = await prisma.clothingItem.findMany({
    where: { imageHash: { in: [...new Set(hashes)] } },
    select: { id: true, name: true, imageHash: true },
    orderBy: { createdAt: "asc" },
  });
  for (const r of rows) if (r.imageHash && !map.has(r.imageHash)) map.set(r.imageHash, { id: r.id, name: r.name });
  return map;
}

export function buildCreateData(params: CreateItemParams): Prisma.ClothingItemCreateInput {
  const editedFields = params.editedFields ?? [];
  return {
    id: params.id ?? newClothingId(),
    ...inputToRowData(params.input),
    imagePath: params.image?.imagePath ?? null,
    originalFilename: params.image?.originalFilename ?? null,
    imageHash: params.image?.imageHash ?? null,
    imageMime: params.image?.imageMime ?? null,
    imageSize: params.image?.imageSize ?? null,
    imageWidth: params.image?.imageWidth ?? null,
    imageHeight: params.image?.imageHeight ?? null,
    source: params.source,
    aiGenerated: params.aiGenerated,
    userEdited: editedFields.length > 0,
    inferredFields: JSON.stringify(params.inferredFields ?? []),
    editedFields: JSON.stringify(editedFields),
    rawImport: params.rawImport === undefined ? null : JSON.stringify(params.rawImport, null, 2),
    schemaVersion: params.aiGenerated ? CLAUDE_SCHEMA_VERSION : null,
    ...(params.createdAt ? { createdAt: params.createdAt } : {}),
  };
}

export async function createItem(params: CreateItemParams, db: Db = prisma): Promise<ClothingItem> {
  const row = await db.clothingItem.create({ data: buildCreateData(params) });
  return rowToItem(row);
}

/**
 * Apply a manual edit. Every field whose value actually changes is recorded in
 * `editedFields` so future imports never overwrite it.
 */
export async function updateItemMetadata(id: string, patch: Partial<ClothingItemInput>): Promise<ClothingItem | null> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.clothingItem.findUnique({ where: { id } });
    if (!row) return null;
    const before = rowToInput(row);
    const changed = changedFields(before, patch);
    if (changed.length === 0) return rowToItem(row);
    const after: ClothingItemInput = { ...before, ...patch };
    const edited = [...new Set([...JSON.parse(row.editedFields || "[]"), ...changed])] as string[];
    const updated = await tx.clothingItem.update({
      where: { id },
      data: { ...inputToRowData(after), editedFields: JSON.stringify(edited), userEdited: edited.length > 0 },
    });
    return rowToItem(updated);
  });
}

/** Replace an item's metadata with imported data while preserving manual edits. */
export async function applyImportedMetadata(
  id: string,
  imported: ClothingItemInput,
  opts: { inferredFields: string[]; rawImport: unknown; source: string },
  db: Db = prisma,
): Promise<ClothingItem | null> {
  const row = await db.clothingItem.findUnique({ where: { id } });
  if (!row) return null;
  const edited = JSON.parse(row.editedFields || "[]") as string[];
  const merged = mergePreservingEdits(rowToInput(row), imported, edited);
  const updated = await db.clothingItem.update({
    where: { id },
    data: {
      ...inputToRowData(merged),
      source: opts.source,
      aiGenerated: true,
      inferredFields: JSON.stringify(opts.inferredFields),
      rawImport: JSON.stringify(opts.rawImport, null, 2),
      schemaVersion: CLAUDE_SCHEMA_VERSION,
    },
  });
  return rowToItem(updated);
}

export async function updateItemImage(id: string, image: ImageFields): Promise<ClothingItem> {
  const row = await prisma.clothingItem.update({ where: { id }, data: image });
  return rowToItem(row);
}

export async function deleteItemRecord(id: string): Promise<ClothingItem | null> {
  const row = await prisma.clothingItem.findUnique({ where: { id }, omit: { rawImport: true } });
  if (!row) return null;
  await prisma.clothingItem.delete({ where: { id } });
  return rowToItem({ ...row, rawImport: null });
}

export async function countOutfitsUsingItem(id: string): Promise<number> {
  const rows = await prisma.outfitItem.findMany({ where: { clothingItemId: id }, select: { outfitId: true }, distinct: ["outfitId"] });
  return rows.length;
}
