import type { ClothingItem as ClothingRow } from "@prisma/client";
import type { ClothingItem, ClothingItemInput, ClothingItemSummary } from "@/lib/types";
import { parseList, parsePairing } from "./serialize";

export { inputToRowData, parseList, parsePairing } from "./serialize";

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
    aiGenerated: row.aiGenerated,
    userEdited: row.userEdited,
    inferredFields: parseList(row.inferredFields),
    editedFields: parseList(row.editedFields),
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSummary(item: Pick<ClothingItem, "id" | "name" | "category" | "subcategory" | "primaryColor" | "tags" | "imageHash" | "imagePath">): ClothingItemSummary {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    primaryColor: item.primaryColor,
    tags: item.tags,
    imageHash: item.imageHash,
    hasImage: Boolean(item.imagePath),
  };
}
