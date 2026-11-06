import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { CATEGORIES, categoryLabel, humanize } from "@/lib/constants/categories";
import { activeFilterCount, FILTER_KEYS, FILTER_LABELS, type SearchFilters, type SortOption } from "@/lib/search/filters";
import { computeFacets, structuredSearch } from "@/lib/search/structured-search";
import type { ClothingItem } from "@/lib/types";
import { useWardrobe } from "~/state/wardrobe";
import { Chip, IconButton } from "~/ui/primitives";
import { radius, type Palette, useColors, useStyles } from "~/ui/theme";
import { ClothingCard } from "./clothing-card";
import { FilterSheet } from "./filter-sheet";

const SORTS: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name", label: "Name" },
];

/**
 * Search box + category chips + filters + 2-column photo grid.
 * Search runs in memory on the loaded wardrobe (lib/search/structured-search.ts).
 */
export function WardrobeBrowser({
  header,
  showFilters = false,
  autoFocus = false,
  selectable = false,
  selectedIds,
  onToggle,
  items: itemsOverride,
  empty,
  bottomPadding = 24,
}: {
  header?: React.ReactElement | null;
  showFilters?: boolean;
  autoFocus?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
  items?: ClothingItem[];
  empty?: React.ReactElement;
  bottomPadding?: number;
}) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { items: all } = useWardrobe();
  const items = itemsOverride ?? all;
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [sort, setSort] = useState<SortOption>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(
    () => structuredSearch(items, q, filters, q.trim() ? "relevance" : sort).map((r) => r.item),
    [items, q, filters, sort],
  );
  const facets = useMemo(() => computeFacets(items), [items]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of items) m[i.category] = (m[i.category] ?? 0) + 1;
    return m;
  }, [items]);
  const categories = useMemo(() => {
    const list: string[] = [...CATEGORIES];
    for (const c of Object.keys(counts)) if (!list.includes(c)) list.push(c);
    return list.filter((c) => (counts[c] ?? 0) > 0);
  }, [counts]);

  const active = filters.category?.[0] ?? null;
  const setCategory = (c: string | null) => setFilters((f) => ({ ...f, category: c ? [c] : undefined, subcategory: undefined }));
  const extra = FILTER_KEYS.filter((k) => k !== "category").flatMap((k) => (filters[k] ?? []).map((v) => ({ key: k, value: v })));

  const controls = (
    <View style={{ paddingBottom: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <View style={styles.search}>
          <Ionicons name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search your wardrobe..."
            placeholderTextColor={colors.mutedForeground}
            autoFocus={autoFocus}
            returnKeyType="search"
            autoCorrect={false}
            style={{ flex: 1, fontSize: 16, color: colors.foreground, paddingVertical: 0 }}
          />
          {q ? <IconButton icon="close-circle" label="Clear search" color={colors.mutedForeground} onPress={() => setQ("")} /> : null}
        </View>
        {showFilters && (
          <Pressable onPress={() => setFiltersOpen(true)} accessibilityLabel="Filters" style={styles.filterBtn}>
            <Ionicons name="options-outline" size={20} color={colors.foreground} />
            {activeFilterCount({ ...filters, category: undefined }) > 0 && (
              <View style={styles.dot}>
                <Text style={{ color: colors.primaryForeground, fontSize: 11 }}>{activeFilterCount({ ...filters, category: undefined })}</Text>
              </View>
            )}
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 10 }}>
        <Chip label="All" active={!active} onPress={() => setCategory(null)} />
        {categories.map((c) => (
          <Chip key={c} label={categoryLabel(c, true)} count={counts[c]} active={active === c} onPress={() => setCategory(active === c ? null : c)} />
        ))}
      </ScrollView>
      {extra.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
          {extra.map(({ key, value }) => (
            <Pressable key={`${key}:${value}`} onPress={() => setFilters((f) => ({ ...f, [key]: f[key]?.filter((v) => v !== value) }))} style={styles.activeFilter}>
              <Text style={{ fontSize: 12 }}>
                <Text style={{ color: colors.mutedForeground }}>{FILTER_LABELS[key]}: </Text>
                {humanize(value)}
              </Text>
              <Ionicons name="close" size={14} color={colors.foreground} />
            </Pressable>
          ))}
          <Pressable onPress={() => setFilters((f) => ({ category: f.category }))} style={{ justifyContent: "center", paddingHorizontal: 6 }}>
            <Text style={{ fontSize: 12, color: colors.mutedForeground, textDecorationLine: "underline" }}>Clear all</Text>
          </Pressable>
        </ScrollView>
      )}
      <View style={styles.countRow}>
        <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>
          {results.length} {results.length === 1 ? "item" : "items"}
        </Text>
        {!q.trim() && (
          <Pressable onPress={() => setSort(SORTS[(SORTS.findIndex((s) => s.value === sort) + 1) % SORTS.length].value)} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>{SORTS.find((s) => s.value === sort)?.label}</Text>
            <Ionicons name="swap-vertical" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
        {q.trim() ? <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>Best match</Text> : null}
      </View>
    </View>
  );

  return (
    <>
      <FlatList
        data={results}
        keyExtractor={(i) => i.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: bottomPadding, gap: 18 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            {header}
            {controls}
          </View>
        }
        ListEmptyComponent={
          empty ?? (
            <View style={{ alignItems: "center", paddingVertical: 48 }}>
              <Text style={{ fontSize: 18, color: colors.foreground }}>Nothing matches</Text>
              <Text style={{ color: colors.mutedForeground, marginTop: 4 }}>Try fewer words or clear some filters.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: "50%" }}>
            <ClothingCard
              item={item}
              selectable={selectable}
              selected={selectedIds?.has(item.id)}
              onPress={selectable ? () => onToggle?.(item.id) : undefined}
            />
          </View>
        )}
      />
      {showFilters && <FilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} facets={facets} filters={filters} onApply={setFilters} />}
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: radius.full, backgroundColor: colors.muted, paddingLeft: 14, paddingRight: 4 },
  filterBtn: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: colors.input, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: -2, right: -2, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  activeFilter: { flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 12, borderRadius: radius.full, backgroundColor: colors.accent },
  countRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 12 },
});
