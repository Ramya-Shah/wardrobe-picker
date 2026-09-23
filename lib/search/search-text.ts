import { categoryLabel } from "@/lib/constants/categories";
import type { ClothingItemInput } from "@/lib/types";

/** Extra words indexed for common subcategories so "tee" finds a tshirt, "pants" finds trousers, etc. */
const SYNONYMS: Record<string, string[]> = {
  tshirt: ["t-shirt", "tee"],
  sweater: ["jumper", "pullover", "knit"],
  trousers: ["pants"],
  chinos: ["pants", "trousers"],
  cargo: ["cargos", "pants"],
  joggers: ["track pants"],
  sneakers: ["trainers", "shoes"],
  running_shoes: ["sneakers", "trainers"],
  formal_shoes: ["dress shoes"],
  hoodie: ["sweatshirt"],
  overshirt: ["shacket", "shirt jacket"],
  jewelry: ["jewellery"],
};

/** Lowercase, strip punctuation (keep hyphens between letters), collapse whitespace. */
export function normalizeText(value: string): string {
  let v = value.toLowerCase();
  try {
    v = v.normalize("NFKD"); // split accents off letters; guarded for JS engines without full Unicode data
  } catch {
    // keep as-is
  }
  return v
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/_/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the normalized searchable text for an item, e.g.
 * "cream brown striped oversized overshirt casual streetwear full sleeve summer spring college".
 *
 * Pairing suggestions are deliberately excluded: searching "white sneakers" should return
 * sneakers, not every pair of jeans that goes well with white sneakers.
 * This string is also the future input for semantic embeddings.
 */
export function buildSearchText(item: ClothingItemInput): string {
  const parts: (string | null | undefined)[] = [
    item.name,
    item.category,
    categoryLabel(item.category, true),
    item.subcategory,
    ...(item.subcategory ? SYNONYMS[item.subcategory] ?? [] : []),
    item.primaryColor,
    ...item.secondaryColors,
    item.pattern,
    item.texture,
    item.graphic,
    item.logo,
    item.material,
    item.fit,
    item.sleeveType,
    item.neckline,
    item.length,
    item.silhouette,
    ...item.styles,
    item.formality,
    ...item.seasons,
    ...item.occasions,
    ...item.environments,
    ...item.tags,
    item.description,
    item.userNotes,
  ];
  const words: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const word of normalizeText(part).split(" ")) {
      if (word && !seen.has(word)) {
        seen.add(word);
        words.push(word);
      }
    }
  }
  return words.join(" ");
}
