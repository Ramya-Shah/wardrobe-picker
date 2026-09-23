"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, SlidersHorizontal, X } from "lucide-react";
import { ClothingCard, ClothingGridSkeleton } from "@/components/clothing/clothing-card";
import { FilterSheet, type Facets } from "@/components/search/filter-sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { CATEGORIES, categoryLabel, humanize } from "@/lib/constants/categories";
import { apiJson, errorMessage } from "@/lib/client/api";
import {
  activeFilterCount,
  FILTER_KEYS,
  FILTER_LABELS,
  searchQueryToParams,
  type SearchFilters,
  type SortOption,
} from "@/lib/search/filters";
import type { SearchResponse } from "@/lib/search/search";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 48;

export interface BrowserState {
  q: string;
  filters: SearchFilters;
  sort: SortOption;
}

/**
 * The wardrobe grid with search, category chips, filters and infinite scrolling.
 * Used by the home screen, /wardrobe, /search, the export picker and the outfit picker.
 */
export function WardrobeBrowser({
  initial,
  initialState,
  categoryCounts,
  facets,
  showFilters = false,
  syncUrl = true,
  autoFocus = false,
  selectable = false,
  selectedIds,
  onToggleSelect,
  onResults,
  emptyState,
  stickyTop = "top-0",
}: {
  initial: SearchResponse | null;
  initialState: BrowserState;
  categoryCounts?: Record<string, number>;
  facets?: Facets | null;
  showFilters?: boolean;
  syncUrl?: boolean;
  autoFocus?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onResults?: (ids: string[], total: number) => void;
  emptyState?: React.ReactNode;
  stickyTop?: string;
}) {
  const [state, setState] = useState<BrowserState>(initialState);
  const [data, setData] = useState<SearchResponse | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const skipFirst = useRef(initial !== null);
  const requestId = useRef(0);

  const paramsFor = useCallback((s: BrowserState, offset: number) => {
    const p = searchQueryToParams({ q: s.q, filters: s.filters, sort: s.sort, offset, limit: PAGE_SIZE });
    return p.toString();
  }, []);

  // Fetch first page whenever the query changes (debounced for typing).
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiJson<SearchResponse>(`/api/items?${paramsFor(state, 0)}`, "GET");
        if (id !== requestId.current) return;
        setData(res);
        setError(null);
      } catch (e) {
        if (id === requestId.current) setError(errorMessage(e));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 220);
    if (syncUrl) {
      const qs = searchQueryToParams({ q: state.q, filters: state.filters, sort: state.sort }).toString();
      window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }
    return () => clearTimeout(t);
  }, [state, paramsFor, syncUrl]);

  useEffect(() => {
    if (data) onResults?.(data.items.map((i) => i.id), data.total);
  }, [data, onResults]);

  const loadMore = useCallback(async () => {
    if (!data || loadingMore || data.items.length >= data.total) return;
    setLoadingMore(true);
    const id = requestId.current;
    try {
      const res = await apiJson<SearchResponse>(`/api/items?${paramsFor(state, data.items.length)}`, "GET");
      if (id !== requestId.current) return;
      setData((prev) => (prev ? { ...res, items: [...prev.items, ...res.items.filter((n) => !prev.items.some((p) => p.id === n.id))] } : res));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }, [data, loadingMore, paramsFor, state]);

  // Infinite scroll sentinel
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: "800px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const activeCategory = state.filters.category?.[0] ?? null;
  const setCategory = (c: string | null) =>
    setState((s) => ({ ...s, filters: { ...s.filters, category: c ? [c] : undefined, subcategory: undefined } }));

  const categoryChips = useMemo(() => {
    const list: string[] = CATEGORIES.filter((c) => c !== "OTHER" || (categoryCounts?.OTHER ?? 0) > 0);
    for (const c of Object.keys(categoryCounts ?? {})) if (!list.includes(c)) list.push(c);
    return categoryCounts ? list.filter((c) => (categoryCounts[c] ?? 0) > 0 || c === activeCategory) : list;
  }, [categoryCounts, activeCategory]);

  const nonCategoryFilters = FILTER_KEYS.filter((k) => k !== "category").flatMap((k) =>
    (state.filters[k] ?? []).map((v) => ({ key: k, value: v })),
  );
  const filterCount = activeFilterCount({ ...state.filters, category: undefined });

  return (
    <div>
      <div className={cn("sticky z-20 -mx-4 bg-background/92 px-4 pb-2 pt-1 backdrop-blur-md", stickyTop)}>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoFocus={autoFocus}
              value={state.q}
              onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
              placeholder="Search your wardrobe..."
              aria-label="Search your wardrobe"
              className="rounded-full bg-secondary pl-10 pr-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {state.q && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setState((s) => ({ ...s, q: "" }))}
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {showFilters && (
            <Button variant="outline" size="icon" className="relative" aria-label="Filters" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal />
              {filterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">
                  {filterCount}
                </span>
              )}
            </Button>
          )}
        </div>
        <div className="scrollbar-none -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4">
          <Chip active={!activeCategory} onClick={() => setCategory(null)}>
            All
          </Chip>
          {categoryChips.map((c) => (
            <Chip key={c} active={activeCategory === c} onClick={() => setCategory(activeCategory === c ? null : c)}>
              {categoryLabel(c, true)}
              {categoryCounts?.[c] !== undefined && <span className="opacity-60">{categoryCounts[c]}</span>}
            </Chip>
          ))}
        </div>
        {nonCategoryFilters.length > 0 && (
          <div className="scrollbar-none -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
            {nonCategoryFilters.map(({ key, value }) => (
              <button
                key={`${key}:${value}`}
                type="button"
                onClick={() =>
                  setState((s) => ({ ...s, filters: { ...s.filters, [key]: s.filters[key]?.filter((v) => v !== value) } }))
                }
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-xs"
              >
                <span className="text-muted-foreground">{FILTER_LABELS[key]}:</span> {humanize(value)}
                <X className="size-3.5" />
              </button>
            ))}
            <button
              type="button"
              className="h-8 shrink-0 px-2 text-xs text-muted-foreground underline"
              onClick={() => setState((s) => ({ ...s, filters: { category: s.filters.category } }))}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="mb-3 mt-1 flex items-center justify-between text-sm text-muted-foreground">
        <span aria-live="polite">
          {loading ? "Searching…" : data ? `${data.total} ${data.total === 1 ? "item" : "items"}` : ""}
        </span>
        <NativeSelect
          aria-label="Sort"
          value={state.sort === "relevance" && !state.q ? "newest" : state.sort}
          onChange={(e) => setState((s) => ({ ...s, sort: e.target.value as SortOption }))}
          className="h-9 w-auto border-0 bg-transparent pr-8 text-sm text-muted-foreground"
        >
          {state.q && <option value="relevance">Best match</option>}
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="name">Name</option>
        </NativeSelect>
      </div>

      {error && <p className="mb-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {!data && loading ? (
        <ClothingGridSkeleton />
      ) : data && data.items.length === 0 ? (
        (emptyState ?? (
          <div className="py-16 text-center">
            <p className="font-serif text-lg">Nothing matches</p>
            <p className="mt-1 text-sm text-muted-foreground">Try fewer words or clear some filters.</p>
          </div>
        ))
      ) : (
        <div className={cn("grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3", loading && "opacity-60 transition-opacity")}>
          {data?.items.map((item, i) => (
            <ClothingCard
              key={item.id}
              item={item}
              priority={i < 4}
              selectable={selectable}
              selected={selectedIds?.has(item.id)}
              onSelect={onToggleSelect}
            />
          ))}
        </div>
      )}

      <div ref={sentinel} className="h-px" />
      {data && data.items.length < data.total && (
        <div className="flex justify-center py-6">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Loader2 className="animate-spin" />} Load more
          </Button>
        </div>
      )}

      {showFilters && (
        <FilterSheet
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          facets={facets ?? null}
          filters={state.filters}
          onApply={(filters) => setState((s) => ({ ...s, filters }))}
        />
      )}
    </div>
  );
}
