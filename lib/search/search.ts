import type { Prisma } from "@prisma/client";
import { listAllItems } from "@/lib/db/clothing";
import { toSummary } from "@/lib/db/mappers";
import type { ClothingItem, ClothingItemSummary } from "@/lib/types";
import type { SearchQuery } from "./filters";
import { getSemanticSearchProvider } from "./semantic-search";
import { computeFacets, structuredSearch, tokenizeQuery, tokenVariants, type ScoredItem } from "./structured-search";

export interface SearchResponse {
  total: number;
  offset: number;
  limit: number;
  items: ClothingItemSummary[];
}

/**
 * Narrow candidates in SQLite (indexed category + LIKE on searchText) before the
 * precise in-memory structured search runs. Keeps 500+ item wardrobes fast.
 */
function prefilter(query: SearchQuery): Prisma.ClothingItemWhereInput {
  const and: Prisma.ClothingItemWhereInput[] = [];
  const categories = query.filters.category;
  if (categories?.length) and.push({ category: { in: categories } });
  for (const token of tokenizeQuery(query.q)) {
    and.push({ OR: tokenVariants(token).map((v) => ({ searchText: { contains: v.replace(/-/g, "") } })) });
  }
  return and.length ? { AND: and } : {};
}

export async function searchItemsFull(query: SearchQuery): Promise<ScoredItem[]> {
  const candidates = await listAllItems(prefilter(query));
  let results = structuredSearch(candidates, query.q, query.filters, query.sort);

  const semantic = getSemanticSearchProvider();
  if (query.q && (await semantic.isAvailable())) {
    const scores = await semantic.score(query.q, candidates);
    results = results
      .map((r) => ({ ...r, score: r.score + (scores.get(r.item.id) ?? 0) * 10 }))
      .sort((a, b) => b.score - a.score);
  }
  return results;
}

export async function searchItems(query: SearchQuery): Promise<SearchResponse> {
  const results = await searchItemsFull(query);
  return {
    total: results.length,
    offset: query.offset,
    limit: query.limit,
    items: results.slice(query.offset, query.offset + query.limit).map((r) => toSummary(r.item)),
  };
}

export async function getFacets(items?: ClothingItem[]) {
  return computeFacets(items ?? (await listAllItems()));
}
