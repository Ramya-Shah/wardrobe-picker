-- CreateTable
CREATE TABLE "ClothingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imagePath" TEXT,
    "originalFilename" TEXT,
    "imageHash" TEXT,
    "imageMime" TEXT,
    "imageSize" INTEGER,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "subcategory" TEXT,
    "primaryColor" TEXT,
    "secondaryColors" TEXT NOT NULL DEFAULT '[]',
    "pattern" TEXT,
    "texture" TEXT,
    "graphic" TEXT,
    "logo" TEXT,
    "material" TEXT,
    "fit" TEXT,
    "sleeveType" TEXT,
    "neckline" TEXT,
    "length" TEXT,
    "silhouette" TEXT,
    "styles" TEXT NOT NULL DEFAULT '[]',
    "formality" TEXT,
    "seasons" TEXT NOT NULL DEFAULT '[]',
    "occasions" TEXT NOT NULL DEFAULT '[]',
    "environments" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "searchText" TEXT NOT NULL DEFAULT '',
    "pairingSuggestions" TEXT NOT NULL DEFAULT '{}',
    "userNotes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "inferredFields" TEXT NOT NULL DEFAULT '[]',
    "editedFields" TEXT NOT NULL DEFAULT '[]',
    "rawImport" TEXT,
    "schemaVersion" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Outfit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "occasion" TEXT,
    "season" TEXT,
    "style" TEXT,
    "explanation" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "rawImport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OutfitItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "outfitId" TEXT NOT NULL,
    "clothingItemId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "OutfitItem_outfitId_fkey" FOREIGN KEY ("outfitId") REFERENCES "Outfit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OutfitItem_clothingItemId_fkey" FOREIGN KEY ("clothingItemId") REFERENCES "ClothingItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ClothingItem_category_idx" ON "ClothingItem"("category");

-- CreateIndex
CREATE INDEX "ClothingItem_subcategory_idx" ON "ClothingItem"("subcategory");

-- CreateIndex
CREATE INDEX "ClothingItem_primaryColor_idx" ON "ClothingItem"("primaryColor");

-- CreateIndex
CREATE INDEX "ClothingItem_formality_idx" ON "ClothingItem"("formality");

-- CreateIndex
CREATE INDEX "ClothingItem_imageHash_idx" ON "ClothingItem"("imageHash");

-- CreateIndex
CREATE INDEX "ClothingItem_createdAt_idx" ON "ClothingItem"("createdAt");

-- CreateIndex
CREATE INDEX "Outfit_createdAt_idx" ON "Outfit"("createdAt");

-- CreateIndex
CREATE INDEX "OutfitItem_clothingItemId_idx" ON "OutfitItem"("clothingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "OutfitItem_outfitId_clothingItemId_key" ON "OutfitItem"("outfitId", "clothingItemId");
