"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import { FILTER_KEYS, FILTER_LABELS, type FilterKey, type SearchFilters } from "@/lib/search/filters";

export type Facets = Record<FilterKey, { value: string; count: number }[]>;

const COLLAPSED = 12;

/** Bottom-sheet filter panel. Filters combine: OR within a group, AND across groups. */
export function FilterSheet({
  open,
  onOpenChange,
  facets,
  filters,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facets: Facets | null;
  filters: SearchFilters;
  onApply: (filters: SearchFilters) => void;
}) {
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [expanded, setExpanded] = useState<Set<FilterKey>>(new Set());

  useEffect(() => {
    // Re-sync the draft each time the sheet opens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(filters);
  }, [open, filters]);

  const toggle = (key: FilterKey, value: string) =>
    setDraft((d) => {
      const current = d[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...d, [key]: next.length ? next : undefined };
    });

  const keys = FILTER_KEYS.filter((k) => (facets?.[k]?.length ?? 0) > 0 || (draft[k]?.length ?? 0) > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent aria-describedby="filter-desc">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription id="filter-desc">Combine filters to narrow down your wardrobe.</SheetDescription>
        </SheetHeader>
        <SheetBody className="space-y-6 pb-4">
          {!facets && <p className="text-sm text-muted-foreground">Loading filters…</p>}
          {facets && keys.length === 0 && <p className="text-sm text-muted-foreground">Add some clothes to filter by color, style, season and more.</p>}
          {keys.map((key) => {
            const options = facets?.[key] ?? [];
            const selected = draft[key] ?? [];
            // Keep selected values visible even if they are not in the facet list.
            const all = [...options, ...selected.filter((s) => !options.some((o) => o.value === s)).map((value) => ({ value, count: 0 }))];
            const visible = expanded.has(key) ? all : all.slice(0, COLLAPSED);
            return (
              <section key={key}>
                <h3 className="mb-2 text-sm font-semibold">{FILTER_LABELS[key]}</h3>
                <div className="flex flex-wrap gap-2">
                  {visible.map(({ value, count }) => (
                    <Chip key={value} active={selected.includes(value)} onClick={() => toggle(key, value)}>
                      {key === "category" ? categoryLabel(value) : humanize(value)}
                      {count > 0 && <span className="opacity-60">{count}</span>}
                    </Chip>
                  ))}
                  {all.length > COLLAPSED && !expanded.has(key) && (
                    <button type="button" className="h-9 px-2 text-sm text-muted-foreground underline" onClick={() => setExpanded((e) => new Set(e).add(key))}>
                      +{all.length - COLLAPSED} more
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" className="flex-1" onClick={() => setDraft({ category: draft.category })}>
            Reset
          </Button>
          <Button
            className="flex-[2]"
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Show results
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
