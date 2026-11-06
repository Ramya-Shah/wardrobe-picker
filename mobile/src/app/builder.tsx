import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { humanize } from "@/lib/constants/categories";
import { OUTFIT_ROLE_LABELS, roleForCategory, SEASONS, type OutfitRole } from "@/lib/constants/vocab";
import type { ClothingItem } from "@/lib/types";
import { RolePager } from "~/components/role-pager";
import { createOutfit } from "~/core/outfits";
import { useWardrobe } from "~/state/wardrobe";
import { Button, Chip, Field, IconButton, Label, Muted, Segmented } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { Sheet } from "~/ui/sheet";
import { useToast } from "~/ui/toast";
import { useColors } from "~/ui/theme";

const OPTIONAL = new Set<OutfitRole>(["OUTERWEAR", "ACCESSORY"]);
const SEPARATES: OutfitRole[] = ["OUTERWEAR", "TOP", "BOTTOM", "SHOES", "ACCESSORY"];
const DRESS: OutfitRole[] = ["OUTERWEAR", "DRESS", "SHOES", "ACCESSORY"];
type Selection = Partial<Record<OutfitRole, string | null>>;

/** Items without seasons count as all-season. */
const fitsSeason = (i: ClothingItem, season: string) => !season || i.seasons.length === 0 || i.seasons.includes(season);

/**
 * Outfit builder: swipe through your own clothes piece by piece (top to toe), lock what you
 * like, shuffle the rest, and save — no Claude needed. "Ask Claude" hands the pieces to the picker.
 */
export default function BuilderScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ item?: string }>();
  const { svc, items, itemsById, refresh } = useWardrobe();
  const toast = useToast();

  const byRole = useMemo(() => {
    const m: Record<OutfitRole, ClothingItem[]> = { TOP: [], BOTTOM: [], DRESS: [], OUTERWEAR: [], SHOES: [], ACCESSORY: [] };
    for (const i of items) {
      const r = roleForCategory(i.category);
      if (r) m[r].push(i);
    }
    return m;
  }, [items]);

  // Start from the item you came from (locked), otherwise the first item of each required row.
  const start = params.item ? itemsById.get(params.item) : undefined;
  const startRole = start ? roleForCategory(start.category) : null;
  const [dressMode, setDressMode] = useState(startRole === "DRESS");
  const [season, setSeason] = useState("");
  const [locked, setLocked] = useState<Set<OutfitRole>>(new Set(startRole ? [startRole] : []));
  const [selected, setSelected] = useState<Selection>(() => {
    const s: Selection = {};
    for (const r of [...SEPARATES, "DRESS" as OutfitRole]) s[r] = OPTIONAL.has(r) ? null : (byRole[r][0]?.id ?? null);
    if (start && startRole) s[startRole] = start.id;
    return s;
  });
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [saving, setSaving] = useState(false);

  const rows = dressMode ? DRESS : SEPARATES;
  const optionsFor = (role: OutfitRole): (ClothingItem | null)[] => {
    const list = byRole[role].filter((i) => fitsSeason(i, season) || selected[role] === i.id);
    return OPTIONAL.has(role) ? [null, ...list] : list;
  };
  const pieces = rows.map((r) => ({ role: r, id: selected[r] ?? null })).filter((p): p is { role: OutfitRole; id: string } => Boolean(p.id && itemsById.has(p.id)));

  const shuffle = () =>
    setSelected((prev) => {
      const next = { ...prev };
      for (const role of rows) {
        if (locked.has(role)) continue;
        const opts = optionsFor(role);
        if (!opts.length) continue;
        // Optional pieces are included about half the time.
        const pool = OPTIONAL.has(role) && Math.random() < 0.5 ? [null] : opts.filter(Boolean);
        const pick = pool[Math.floor(Math.random() * pool.length)] ?? null;
        next[role] = pick?.id ?? null;
      }
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      const id = await createOutfit(
        svc,
        {
          name: name.trim() || (occasion.trim() ? `${humanize(occasion.trim())} outfit` : "My outfit"),
          description: null,
          occasion: occasion.trim() || null,
          season: season || null,
          style: null,
          explanation: null,
          items: pieces.map((p) => ({ clothingItemId: p.id, role: p.role })),
        },
        { source: "manual" },
      );
      await refresh();
      setSaveOpen(false);
      toast("Outfit saved");
      router.replace(`/outfit/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
      setSaving(false);
    }
  };

  const hasDresses = byRole.DRESS.length > 0;

  return (
    <Screen title="Build outfit" back actions={<IconButton icon="shuffle" label="Shuffle unlocked pieces" onPress={shuffle} />}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 24 }}>
        <View style={{ gap: 10 }}>
          {hasDresses && (
            <Segmented
              value={dressMode ? "dress" : "separates"}
              onChange={(v) => setDressMode(v === "dress")}
              options={[
                { value: "separates", label: "Top + bottom" },
                { value: "dress", label: "Dress" },
              ]}
            />
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            <Chip label="Any season" active={!season} onPress={() => setSeason("")} />
            {SEASONS.map((s) => (
              <Chip key={s} label={humanize(s)} active={season === s} onPress={() => setSeason(season === s ? "" : s)} />
            ))}
          </ScrollView>
          <Muted>Swipe each row to change that piece · lock the ones you like · shuffle the rest.</Muted>
        </View>

        {rows.map((role) => (
          <RolePager
            key={role}
            label={OUTFIT_ROLE_LABELS[role]}
            options={optionsFor(role)}
            selectedId={selected[role] ?? null}
            onSelect={(id) => setSelected((s) => ({ ...s, [role]: id }))}
            locked={locked.has(role)}
            onToggleLock={() =>
              setLocked((l) => {
                const n = new Set(l);
                if (n.has(role)) n.delete(role);
                else n.add(role);
                return n;
              })
            }
            emptyText={`No ${OUTFIT_ROLE_LABELS[role].toLowerCase()} in your wardrobe yet`}
          />
        ))}
      </ScrollView>

      <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <Button
          title="Ask Claude"
          icon="sparkles-outline"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() => router.push(`/picker?item=${pieces.filter((p) => locked.has(p.role)).map((p) => p.id).join(",") || pieces.map((p) => p.id).join(",")}`)}
        />
        <Button title={`Save (${pieces.length})`} icon="bookmark-outline" style={{ flex: 1 }} disabled={pieces.length < 2} onPress={() => setSaveOpen(true)} />
      </View>

      <Sheet visible={saveOpen} onClose={() => setSaveOpen(false)} title="Save outfit" description={pieces.map((p) => itemsById.get(p.id)?.name).join(" · ")} footer={<Button title="Save outfit" style={{ flex: 1 }} loading={saving} onPress={save} />}>
        <View style={{ gap: 12 }}>
          <View>
            <Label>Name</Label>
            <Field value={name} onChangeText={setName} placeholder="Weekend outfit" />
          </View>
          <View>
            <Label>Occasion (optional)</Label>
            <Field value={occasion} onChangeText={setOccasion} placeholder="casual dinner" autoCapitalize="none" />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
}
