import { normalizeText } from "./search-text";
import { facetValue, FILTER_KEYS, type FilterKey, type SearchFilters, type SortOption } from "./filters";
import type { ClothingItem } from "@/lib/types";

/**
 * Structured (non-AI) search. Pure functions over ClothingItem so they are easy to test
 * and can run on any candidate set (DB-prefiltered or in memory).
 */

const STOPWORDS = new Set(["a", "an", "the", "and", "or", "for", "with", "my", "of", "in", "to", "me", "some", "any"]);

export interface ScoredItem {
  item: ClothingItem;
  score: number;
}

export function tokenizeQuery(q: string): string[] {
  return normalizeText(q)
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t))
    .slice(0, 12);
}

/** "sneakers" → ["sneakers", "sneaker"], "dresses" → ["dresses", "dress"] */
export function tokenVariants(token: string): string[] {
  const variants = [token];
  if (token.length > 3 && token.endsWith("es") && /(ss|sh|ch|x)es$/.test(token)) variants.push(token.slice(0, -2));
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) variants.push(token.slice(0, -1));
  if (token === "tee" || token === "tees" || token === "t-shirt" || token === "t-shirts") variants.push("tshirt");
  return [...new Set(variants)];
}

function wordsOf(value: string | null | undefined): string[] {
  return value ? normalizeText(value).split(" ").filter(Boolean) : [];
}

/** True when any word in `words` starts with any of the variants ("stripe" matches "striped"). */
function prefixMatch(words: string[], variants: string[]): boolean {
  return words.some((w) => variants.some((v) => w.startsWith(v) || (v.includes("-") && w === v.replace(/-/g, ""))));
}

const FIELD_WEIGHTS: { weight: number; get: (i: ClothingItem) => (string | null | undefined)[] }[] = [
  { weight: 6, get: (i) => [i.name] },
  { weight: 5, get: (i) => [i.subcategory, i.category] },
  { weight: 4, get: (i) => [i.primaryColor] },
  { weight: 3, get: (i) => i.tags },
  { weight: 2, get: (i) => [...i.secondaryColors, i.pattern, i.fit, i.material, i.formality, ...i.styles, ...i.seasons, ...i.occasions] },
  { weight: 1, get: (i) => [i.texture, i.graphic, i.logo, i.sleeveType, i.neckline, i.length, i.silhouette, ...i.environments, i.description, i.userNotes] },
];

/**
 * Score an item against query tokens. Every token must match somewhere in the item's
 * searchText (AND semantics), otherwise the score is 0. Matches in important fields score higher.
 */
export function scoreItem(item: ClothingItem, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const searchWords = item.searchText.split(" ");
  let score = 0;
  for (const token of tokens) {
    const variants = tokenVariants(token);
    if (!prefixMatch(searchWords, variants)) return 0;
    let best = 0.5; // matched via searchText only (e.g. synonyms)
    for (const field of FIELD_WEIGHTS) {
      if (field.weight <= best) continue;
      if (field.get(item).some((v) => prefixMatch(wordsOf(v), variants))) best = field.weight;
    }
    score += best;
  }
  return score;
}

function valuesForFilter(item: ClothingItem, key: FilterKey): string[] {
  switch (key) {
    case "category":
      return [item.category];
    case "subcategory":
      return item.subcategory ? [item.subcategory] : [];
    case "color":
      return [item.primaryColor, ...item.secondaryColors].filter((v): v is string => Boolean(v));
    case "pattern":
      return item.pattern ? [item.pattern] : [];
    case "style":
      return item.styles;
    case "fit":
      return item.fit ? [item.fit] : [];
    case "season":
      return item.seasons;
    case "occasion":
      return item.occasions;
    case "formality":
      return item.formality ? [item.formality] : [];
    case "material":
      return item.material ? [item.material] : [];
  }
}

/** Normalize a value for filter comparison (categories compare uppercased, everything else via facetValue). */
export function filterKeyValue(key: FilterKey, value: string): string | null {
  if (key === "category") return value.toUpperCase();
  if (key === "subcategory" || key === "formality") return value.toLowerCase().replace(/[\s-]+/g, "_");
  return facetValue(value);
}

/** OR within a filter, AND across filters. */
export function matchesFilters(item: ClothingItem, filters: SearchFilters): boolean {
  for (const key of FILTER_KEYS) {
    const wanted = filters[key];
    if (!wanted?.length) continue;
    const wantedSet = new Set(wanted.map((v) => filterKeyValue(key, v)));
    const values = valuesForFilter(item, key).map((v) => filterKeyValue(key, v));
    if (!values.some((v) => v !== null && wantedSet.has(v))) return false;
  }
  return true;
}

export function sortResults(results: ScoredItem[], sort: SortOption, hasQuery: boolean): ScoredItem[] {
  const byNewest = (a: ScoredItem, b: ScoredItem) => b.item.createdAt.localeCompare(a.item.createdAt);
  const sorted = [...results];
  switch (sort) {
    case "newest":
      return sorted.sort(byNewest);
    case "oldest":
      return sorted.sort((a, b) => -byNewest(a, b));
    case "name":
      return sorted.sort((a, b) => a.item.name.localeCompare(b.item.name));
    case "relevance":
    default:
      return hasQuery ? sorted.sort((a, b) => b.score - a.score || byNewest(a, b)) : sorted.sort(byNewest);
  }
}

export function structuredSearch(
  items: ClothingItem[],
  q: string,
  filters: SearchFilters,
  sort: SortOption = "relevance",
): ScoredItem[] {
  const tokens = tokenizeQuery(q);
  const results: ScoredItem[] = [];
  for (const item of items) {
    if (!matchesFilters(item, filters)) continue;
    const score = scoreItem(item, tokens);
    if (score > 0) results.push({ item, score });
  }
  return sortResults(results, sort, tokens.length > 0);
}

/** Collect available filter values (with counts) from a set of items. */
export function computeFacets(items: ClothingItem[]): Record<FilterKey, { value: string; count: number }[]> {
  const out = {} as Record<FilterKey, { value: string; count: number }[]>;
  for (const key of FILTER_KEYS) {
    const counts = new Map<string, number>();
    for (const item of items) {
      const seen = new Set<string>();
      for (const raw of valuesForFilter(item, key)) {
        const v = filterKeyValue(key, raw);
        if (!v || seen.has(v)) continue;
        seen.add(v);
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
    }
    out[key] = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  return out;
}
