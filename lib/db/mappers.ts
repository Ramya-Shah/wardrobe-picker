import type { ClothingItem as ClothingRow } from "@prisma/client";
import { PAIRING_KEYS } from "@/lib/constants/vocab";
import { buildSearchText } from "@/lib/search/search-text";
import {
  emptyPairingSuggestions,
  type ClothingItem,
  type ClothingItemInput,
  type ClothingItemSummary,
  type PairingSuggestions,
} from "@/lib/types";

/** Parse a JSON string[] column defensively — a corrupt value never crashes a page. */
export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export function parsePairing(value: string | null | undefined): PairingSuggestions {
  const out = emptyPairingSuggestions();
  if (!value) return out;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      for (const key of PAIRING_KEYS) {
        const list = (parsed as Record<string, unknown>)[key];
        if (Array.isArray(list)) out[key] = list.filter((v): v is string => typeof v === "string");
      }
    }
  } catch {
    // fall through with empty suggestions
  }
  return out;
}

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

/** Serialize metadata into the column values Prisma expects (including the derived searchText). */
export function inputToRowData(input: ClothingItemInput) {
  return {
    name: input.name,
    category: input.category,
    subcategory: input.subcategory,
    primaryColor: input.primaryColor,
    secondaryColors: JSON.stringify(input.secondaryColors),
    pattern: input.pattern,
    texture: input.texture,
    graphic: input.graphic,
    logo: input.logo,
    material: input.material,
    fit: input.fit,
    sleeveType: input.sleeveType,
    neckline: input.neckline,
    length: input.length,
    silhouette: input.silhouette,
    styles: JSON.stringify(input.styles),
    formality: input.formality,
    seasons: JSON.stringify(input.seasons),
    occasions: JSON.stringify(input.occasions),
    environments: JSON.stringify(input.environments),
    tags: JSON.stringify(input.tags),
    description: input.description,
    pairingSuggestions: JSON.stringify(input.pairingSuggestions),
    userNotes: input.userNotes,
    searchText: buildSearchText(input),
  };
}
