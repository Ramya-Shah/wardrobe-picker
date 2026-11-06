import type { Db } from "./services";

/**
 * On-device SQLite schema. Same tables and columns as the web app's prisma/schema.prisma,
 * so data moves between them through the shared backup format. Dates are ISO-8601 text.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS ClothingItem (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    imagePath TEXT, originalFilename TEXT, imageHash TEXT, imageMime TEXT,
    imageSize INTEGER, imageWidth INTEGER, imageHeight INTEGER,
    category TEXT NOT NULL DEFAULT 'OTHER', subcategory TEXT,
    primaryColor TEXT, secondaryColors TEXT NOT NULL DEFAULT '[]',
    pattern TEXT, texture TEXT, graphic TEXT, logo TEXT,
    material TEXT, fit TEXT, sleeveType TEXT, neckline TEXT, length TEXT, silhouette TEXT,
    styles TEXT NOT NULL DEFAULT '[]', formality TEXT,
    seasons TEXT NOT NULL DEFAULT '[]', occasions TEXT NOT NULL DEFAULT '[]', environments TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]', description TEXT, searchText TEXT NOT NULL DEFAULT '',
    pairingSuggestions TEXT NOT NULL DEFAULT '{}',
    userNotes TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    aiGenerated INTEGER NOT NULL DEFAULT 0,
    userEdited INTEGER NOT NULL DEFAULT 0,
    inferredFields TEXT NOT NULL DEFAULT '[]',
    editedFields TEXT NOT NULL DEFAULT '[]',
    rawImport TEXT,
    schemaVersion INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS ClothingItem_category_idx ON ClothingItem(category);
  CREATE INDEX IF NOT EXISTS ClothingItem_imageHash_idx ON ClothingItem(imageHash);
  CREATE INDEX IF NOT EXISTS ClothingItem_createdAt_idx ON ClothingItem(createdAt);

  CREATE TABLE IF NOT EXISTS Outfit (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT, occasion TEXT, season TEXT, style TEXT, explanation TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    rawImport TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS OutfitItem (
    id TEXT PRIMARY KEY NOT NULL,
    outfitId TEXT NOT NULL REFERENCES Outfit(id) ON DELETE CASCADE,
    clothingItemId TEXT NOT NULL REFERENCES ClothingItem(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    UNIQUE(outfitId, clothingItemId)
  );
  CREATE INDEX IF NOT EXISTS OutfitItem_clothingItemId_idx ON OutfitItem(clothingItemId);
  `,
  // v2: app preferences (theme, backup reminder…) as simple key/value pairs.
  `
  CREATE TABLE IF NOT EXISTS Setting (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

/** Apply pending migrations, tracked with PRAGMA user_version. */
export async function migrate(db: Db): Promise<void> {
  await db.exec("PRAGMA foreign_keys = ON;");
  const row = await db.first<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[v]);
      await tx.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
}
