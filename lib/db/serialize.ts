/**
 * Pure (de)serialization of clothing metadata to database columns.
 * Shared by the web app (Prisma) and the mobile app (expo-sqlite): same columns, same JSON encoding.
 */
import { PAIRING_KEYS } from "@/lib/constants/vocab";
import { buildSearchText } from "@/lib/search/search-text";
import { emptyPairingSuggestions, type ClothingItemInput, type PairingSuggestions } from "@/lib/types";

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
