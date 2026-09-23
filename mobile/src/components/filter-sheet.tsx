import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import { FILTER_KEYS, FILTER_LABELS, type FilterKey, type SearchFilters } from "@/lib/search/filters";
import { Button, Chip, SectionTitle } from "~/ui/primitives";
import { Sheet } from "~/ui/sheet";
import { colors } from "~/ui/theme";

export type Facets = Record<FilterKey, { value: string; count: number }[]>;

const COLLAPSED = 12;

/** Filters combine: OR within a group, AND across groups. */
export function FilterSheet({
  visible,
  onClose,
  facets,
  filters,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  facets: Facets;
  filters: SearchFilters;
  onApply: (f: SearchFilters) => void;
}) {
  const [draft, setDraft] = useState(filters);
  const [expanded, setExpanded] = useState<Set<FilterKey>>(new Set());
  // Start from the applied filters each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(filters);
  }

  const toggle = (key: FilterKey, value: string) =>
    setDraft((d) => {
      const cur = d[key] ?? [];
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      return { ...d, [key]: next.length ? next : undefined };
    });

  const keys = FILTER_KEYS.filter((k) => k !== "category" && ((facets[k]?.length ?? 0) > 0 || (draft[k]?.length ?? 0) > 0));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      description="Combine filters to narrow down your wardrobe."
      footer={
        <>
          <Button title="Reset" variant="outline" style={{ flex: 1 }} onPress={() => setDraft({ category: draft.category })} />
          <Button
            title="Show results"
            style={{ flex: 2 }}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          />
        </>
      }
    >
      {keys.length === 0 && <Text style={{ color: colors.mutedForeground }}>Add some clothes to filter by color, style, season and more.</Text>}
      {keys.map((key) => {
        const selected = draft[key] ?? [];
        const all = [...(facets[key] ?? []), ...selected.filter((s) => !facets[key]?.some((o) => o.value === s)).map((value) => ({ value, count: 0 }))];
        const shown = expanded.has(key) ? all : all.slice(0, COLLAPSED);
        return (
          <View key={key} style={{ marginBottom: 20 }}>
            <SectionTitle>{FILTER_LABELS[key]}</SectionTitle>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {shown.map(({ value, count }) => (
                <Chip key={value} label={key === "category" ? categoryLabel(value) : humanize(value)} count={count || undefined} active={selected.includes(value)} onPress={() => toggle(key, value)} />
              ))}
              {all.length > COLLAPSED && !expanded.has(key) && (
                <Pressable onPress={() => setExpanded((e) => new Set(e).add(key))} style={{ height: 36, justifyContent: "center", paddingHorizontal: 6 }}>
                  <Text style={{ color: colors.mutedForeground, textDecorationLine: "underline" }}>+{all.length - COLLAPSED} more</Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      })}
    </Sheet>
  );
}
