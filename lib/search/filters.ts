/** Search/filter model shared by the API, server pages and client components. */

export const FILTER_KEYS = [
  "category",
  "subcategory",
  "color",
  "pattern",
  "style",
  "fit",
  "season",
  "occasion",
  "formality",
  "material",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];
export type SearchFilters = Partial<Record<FilterKey, string[]>>;

export const FILTER_LABELS: Record<FilterKey, string> = {
  category: "Category",
  subcategory: "Type",
  color: "Color",
  pattern: "Pattern",
  style: "Style",
  fit: "Fit",
  season: "Season",
  occasion: "Occasion",
  formality: "Formality",
  material: "Material",
};

export const SORT_OPTIONS = ["relevance", "newest", "oldest", "name"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface SearchQuery {
  q: string;
  filters: SearchFilters;
  sort: SortOption;
  offset: number;
  limit: number;
}

const HEDGES = /^(likely|possibly|probably|maybe|perhaps|appears to be|looks like|seems|some kind of)\s+/;

/**
 * Canonical form of an attribute value for faceting/filtering:
 * "Likely Cotton" → "cotton", "vertical stripes" stays "vertical stripes".
 */
export function facetValue(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.toLowerCase().trim().replace(/_/g, " ").replace(/\s+/g, " ");
  for (let i = 0; i < 2; i++) v = v.replace(HEDGES, "");
  v = v.replace(/[.;:!?]+$/, "").trim();
  return v || null;
}

export function hasActiveFilters(filters: SearchFilters): boolean {
  return FILTER_KEYS.some((k) => (filters[k]?.length ?? 0) > 0);
}

export function activeFilterCount(filters: SearchFilters): number {
  return FILTER_KEYS.reduce((n, k) => n + (filters[k]?.length ?? 0), 0);
}

/** Read a search query from URL params: ?q=black&category=TOP&color=black,white&sort=newest */
export function searchQueryFromParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  defaults: Partial<SearchQuery> = {},
): SearchQuery {
  const get = (key: string): string[] => {
    const raw =
      params instanceof URLSearchParams
        ? params.getAll(key)
        : ([] as string[]).concat(params[key] ?? []);
    return raw
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((v) => v.slice(0, 100));
  };
  const filters: SearchFilters = {};
  for (const key of FILTER_KEYS) {
    const values = get(key);
    if (values.length) filters[key] = key === "category" ? values.map((v) => v.toUpperCase()) : values.map((v) => v.toLowerCase());
  }
  const sortRaw = get("sort")[0];
  const sort = (SORT_OPTIONS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SortOption) : defaults.sort ?? "relevance";
  const offset = Math.max(0, Number.parseInt(get("offset")[0] ?? "", 10) || 0);
  const limit = Math.min(200, Math.max(1, Number.parseInt(get("limit")[0] ?? "", 10) || defaults.limit || 48));
  return { q: (get("q").join(" ") || defaults.q || "").slice(0, 200), filters, sort, offset, limit };
}

export function searchQueryToParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  for (const key of FILTER_KEYS) {
    const values = query.filters?.[key];
    if (values?.length) params.set(key, values.join(","));
  }
  if (query.sort && query.sort !== "relevance") params.set("sort", query.sort);
  if (query.offset) params.set("offset", String(query.offset));
  if (query.limit) params.set("limit", String(query.limit));
  return params;
}
