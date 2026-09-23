import { EDITABLE_FIELDS } from "@/lib/constants/fields";
import { inputToRowData, parseList, parsePairing } from "@/lib/db/serialize";
import { CLAUDE_SCHEMA_VERSION } from "@/lib/validation/clothing";
import type { ClothingItem, ClothingItemInput, EditableField } from "@/lib/types";
import type { Db, Services, SqlValue } from "./services";
import { newClothingId } from "./ids";
import { deleteItemFiles } from "./images";

/** A ClothingItem row as stored in SQLite (booleans are 0/1, dates ISO text). */
export interface ClothingRow {
  id: string;
  name: string;
  imagePath: string | null;
  originalFilename: string | null;
  imageHash: string | null;
  imageMime: string | null;
  imageSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  category: string;
  subcategory: string | null;
  primaryColor: string | null;
  secondaryColors: string;
  pattern: string | null;
  texture: string | null;
  graphic: string | null;
  logo: string | null;
  material: string | null;
  fit: string | null;
  sleeveType: string | null;
  neckline: string | null;
  length: string | null;
  silhouette: string | null;
  styles: string;
  formality: string | null;
  seasons: string;
  occasions: string;
  environments: string;
  tags: string;
  description: string | null;
  searchText: string;
  pairingSuggestions: string;
  userNotes: string | null;
  source: string;
  aiGenerated: number;
  userEdited: number;
  inferredFields: string;
  editedFields: string;
  rawImport: string | null;
  schemaVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImageFields {
  imagePath: string | null;
  originalFilename: string | null;
  imageHash: string | null;
  imageMime: string | null;
  imageSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

// Every column except the (possibly large) raw import blob.
const LIST_COLUMNS =
  "id,name,imagePath,originalFilename,imageHash,imageMime,imageSize,imageWidth,imageHeight,category,subcategory,primaryColor,secondaryColors,pattern,texture,graphic,logo,material,fit,sleeveType,neckline,length,silhouette,styles,formality,seasons,occasions,environments,tags,description,searchText,pairingSuggestions,userNotes,source,aiGenerated,userEdited,inferredFields,editedFields,NULL AS rawImport,schemaVersion,createdAt,updatedAt";

export function rowToInput(row: ClothingRow): ClothingItemInput {
  return {
    name: row.name,
    category: row.category,
    subcategory: row.subcategory,
    primaryColor: row.primaryColor,
    secondaryColors: parseList(row.secondaryColors),
    pattern: row.pattern,
    texture: row.texture,
    graphic: row.graphic,
    logo: row.logo,
    material: row.material,
    fit: row.fit,
    sleeveType: row.sleeveType,
    neckline: row.neckline,
    length: row.length,
    silhouette: row.silhouette,
    styles: parseList(row.styles),
    formality: row.formality,
    seasons: parseList(row.seasons),
    occasions: parseList(row.occasions),
    environments: parseList(row.environments),
    tags: parseList(row.tags),
    description: row.description,
    pairingSuggestions: parsePairing(row.pairingSuggestions),
    userNotes: row.userNotes,
  };
}

export function rowToItem(row: ClothingRow): ClothingItem {
  return {
    ...rowToInput(row),
    id: row.id,
    imagePath: row.imagePath,
    originalFilename: row.originalFilename,
    imageHash: row.imageHash,
    imageMime: row.imageMime,
    imageSize: row.imageSize,
    imageWidth: row.imageWidth,
    imageHeight: row.imageHeight,
    searchText: row.searchText,
    source: row.source,
    aiGenerated: Boolean(row.aiGenerated),
    userEdited: Boolean(row.userEdited),
    inferredFields: parseList(row.inferredFields),
    editedFields: parseList(row.editedFields),
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Which editable fields differ between two metadata objects (only keys present in `after`). */
export function changedFields(before: ClothingItemInput, after: Partial<ClothingItemInput>): EditableField[] {
  return EDITABLE_FIELDS.filter((key) => key in after && !sameValue(before[key], after[key]));
}

/** Imported metadata replaces Claude's values but never fields the user corrected by hand. */
export function mergePreservingEdits(existing: ClothingItemInput, imported: ClothingItemInput, editedFields: string[]): ClothingItemInput {
  const merged = { ...imported } as Record<EditableField, unknown>;
  for (const key of EDITABLE_FIELDS) if (editedFields.includes(key)) merged[key] = existing[key];
  if (existing.userNotes && !imported.userNotes) merged.userNotes = existing.userNotes;
  return merged as unknown as ClothingItemInput;
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
  rawImportText?: string | null;
  createdAt?: string;
}

/** Column values for an INSERT. */
export function buildRow(svc: Pick<Services, "randomBytes">, p: CreateItemParams): ClothingRow {
  const now = new Date().toISOString();
  const edited = p.editedFields ?? [];
  return {
    id: p.id ?? newClothingId(svc),
    ...inputToRowData(p.input),
    imagePath: p.image?.imagePath ?? null,
    originalFilename: p.image?.originalFilename ?? null,
    imageHash: p.image?.imageHash ?? null,
    imageMime: p.image?.imageMime ?? null,
    imageSize: p.image?.imageSize ?? null,
    imageWidth: p.image?.imageWidth ?? null,
    imageHeight: p.image?.imageHeight ?? null,
    source: p.source,
    aiGenerated: p.aiGenerated ? 1 : 0,
    userEdited: edited.length ? 1 : 0,
    inferredFields: JSON.stringify(p.inferredFields ?? []),
    editedFields: JSON.stringify(edited),
    rawImport: p.rawImportText ?? (p.rawImport === undefined ? null : JSON.stringify(p.rawImport, null, 2)),
    schemaVersion: p.aiGenerated ? CLAUDE_SCHEMA_VERSION : null,
    createdAt: p.createdAt ?? now,
    updatedAt: now,
  };
}

export async function insertRow(db: Db, row: ClothingRow): Promise<void> {
  const keys = Object.keys(row) as (keyof ClothingRow)[];
  await db.run(
    `INSERT INTO ClothingItem (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`,
    keys.map((k) => row[k] as SqlValue),
  );
}

async function updateColumns(db: Db, id: string, cols: Partial<ClothingRow>): Promise<void> {
  const keys = Object.keys(cols) as (keyof ClothingRow)[];
  if (!keys.length) return;
  await db.run(
    `UPDATE ClothingItem SET ${keys.map((k) => `${k} = ?`).join(", ")}, updatedAt = ? WHERE id = ?`,
    [...keys.map((k) => cols[k] as SqlValue), new Date().toISOString(), id],
  );
}

export async function createItem(svc: Services, p: CreateItemParams, db: Db = svc.db): Promise<ClothingItem> {
  const row = buildRow(svc, p);
  await insertRow(db, row);
  return rowToItem(row);
}

export async function getItem(db: Db, id: string): Promise<ClothingItem | null> {
  const row = await db.first<ClothingRow>(`SELECT ${LIST_COLUMNS} FROM ClothingItem WHERE id = ?`, [id]);
  return row ? rowToItem(row) : null;
}

export async function getRawImport(db: Db, id: string): Promise<string | null> {
  return (await db.first<{ rawImport: string | null }>("SELECT rawImport FROM ClothingItem WHERE id = ?", [id]))?.rawImport ?? null;
}

export async function listItems(db: Db): Promise<ClothingItem[]> {
  const rows = await db.all<ClothingRow>(`SELECT ${LIST_COLUMNS} FROM ClothingItem ORDER BY createdAt DESC`);
  return rows.map(rowToItem);
}

export async function findItemsByHashes(db: Db, hashes: string[]): Promise<Map<string, { id: string; name: string }>> {
  const map = new Map<string, { id: string; name: string }>();
  const unique = [...new Set(hashes)];
  for (let i = 0; i < unique.length; i += 400) {
    const chunk = unique.slice(i, i + 400);
    const rows = await db.all<{ id: string; name: string; imageHash: string }>(
      `SELECT id, name, imageHash FROM ClothingItem WHERE imageHash IN (${chunk.map(() => "?").join(",")}) ORDER BY createdAt ASC`,
      chunk,
    );
    for (const r of rows) if (!map.has(r.imageHash)) map.set(r.imageHash, { id: r.id, name: r.name });
  }
  return map;
}

/** Manual edit: changed fields are remembered as user-edited. */
export async function updateItemMetadata(db: Db, id: string, patch: Partial<ClothingItemInput>): Promise<ClothingItem | null> {
  return db.transaction(async (tx) => {
    const row = await tx.first<ClothingRow>("SELECT * FROM ClothingItem WHERE id = ?", [id]);
    if (!row) return null;
    const before = rowToInput(row);
    const changed = changedFields(before, patch);
    if (changed.length) {
      const edited = [...new Set([...parseList(row.editedFields), ...changed])];
      await updateColumns(tx, id, {
        ...inputToRowData({ ...before, ...patch }),
        editedFields: JSON.stringify(edited),
        userEdited: edited.length ? 1 : 0,
      });
    }
    return getItem(tx, id);
  });
}

export async function applyImportedMetadata(
  db: Db,
  id: string,
  imported: ClothingItemInput,
  opts: { inferredFields: string[]; rawImport: unknown; source: string },
): Promise<ClothingItem | null> {
  const row = await db.first<ClothingRow>("SELECT * FROM ClothingItem WHERE id = ?", [id]);
  if (!row) return null;
  const merged = mergePreservingEdits(rowToInput(row), imported, parseList(row.editedFields));
  await updateColumns(db, id, {
    ...inputToRowData(merged),
    source: opts.source,
    aiGenerated: 1,
    inferredFields: JSON.stringify(opts.inferredFields),
    rawImport: JSON.stringify(opts.rawImport, null, 2),
    schemaVersion: CLAUDE_SCHEMA_VERSION,
  });
  return getItem(db, id);
}

export async function setItemImage(db: Db, id: string, image: ImageFields): Promise<void> {
  await updateColumns(db, id, image);
}

export async function deleteItem(svc: Services, id: string, opts: { keepImage?: boolean } = {}): Promise<boolean> {
  const item = await getItem(svc.db, id);
  if (!item) return false;
  await svc.db.transaction(async (tx) => {
    await tx.run("DELETE FROM OutfitItem WHERE clothingItemId = ?", [id]);
    await tx.run("DELETE FROM ClothingItem WHERE id = ?", [id]);
  });
  if (!opts.keepImage) await deleteItemFiles(svc, item.imagePath);
  return true;
}

export async function countOutfitsUsingItem(db: Db, id: string): Promise<number> {
  const row = await db.first<{ n: number }>("SELECT COUNT(DISTINCT outfitId) AS n FROM OutfitItem WHERE clothingItemId = ?", [id]);
  return row?.n ?? 0;
}
