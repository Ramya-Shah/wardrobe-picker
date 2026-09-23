import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { humanize } from "@/lib/constants/categories";
import { COMMON_OCCASIONS, COMMON_STYLES, OUTFIT_ROLE_LABELS, OUTFIT_ROLES, SEASONS } from "@/lib/constants/vocab";
import { buildOutfitPrompt } from "@/lib/export/claude-context";
import { pickOutfitCandidates } from "@/lib/outfits/picker";
import { ClothingCard } from "~/components/clothing-card";
import { CopySheet } from "~/components/copy-sheet";
import { WardrobeBrowser } from "~/components/wardrobe-browser";
import { createOutfit, defaultRole } from "~/core/outfits";
import { useWardrobe } from "~/state/wardrobe";
import { Button, Card, Chip, Field, IconButton, Label, Muted, SectionTitle } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { Sheet } from "~/ui/sheet";
import { useToast } from "~/ui/toast";
import { colors, radius } from "~/ui/theme";

const CONTEXT_PER_ROLE = 8;

/**
 * Outfit Picker: set occasion / style / season and required items, see ranked candidates
 * per role, then copy a ready-made request for Claude — or save your own pick.
 */
export default function PickerScreen() {
  const params = useLocalSearchParams<{ item?: string }>();
  const { svc, items, itemsById, refresh } = useWardrobe();
  const toast = useToast();
  const [occasion, setOccasion] = useState("");
  const [style, setStyle] = useState("");
  const [season, setSeason] = useState("");
  const [required, setRequired] = useState<string[]>(params.item ? [params.item] : []);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [chooser, setChooser] = useState(false);
  const [chooserSel, setChooserSel] = useState<Set<string>>(new Set());
  const [prompt, setPrompt] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const result = useMemo(() => pickOutfitCandidates(items, { occasion, style, season, requiredIds: required }), [items, occasion, style, season, required]);
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const copyForClaude = () => {
    const ids = [...new Set([...required, ...picked, ...OUTFIT_ROLES.flatMap((r) => result.groups[r].slice(0, CONTEXT_PER_ROLE).map((c) => c.item.id))])];
    const context = ids.map((id) => itemsById.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
    setPrompt(buildOutfitPrompt(context, { occasion: occasion || null, style: style || null, season: season || null, requiredIds: required }));
  };

  const save = async () => {
    const pieces = [...required, ...picked].map((id) => itemsById.get(id)).filter((i): i is NonNullable<typeof i> => Boolean(i));
    setSaving(true);
    try {
      const id = await createOutfit(
        svc,
        {
          name: name.trim() || [humanize(occasion), "outfit"].filter(Boolean).join(" ") || "Outfit",
          description: null,
          occasion: occasion || null,
          style: style || null,
          season: season || null,
          explanation: null,
          items: pieces.map((p) => ({ clothingItemId: p.id, role: defaultRole(p.category) })),
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

  const count = required.length + picked.size;

  return (
    <Screen title="Outfit picker" back>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 22, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Card style={{ padding: 14, gap: 14 }}>
          <View>
            <Label>Occasion</Label>
            <Field value={occasion} onChangeText={setOccasion} placeholder="casual dinner" autoCapitalize="none" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingTop: 8 }}>
              {COMMON_OCCASIONS.map((o) => (
                <Chip key={o} label={humanize(o)} active={occasion === o.replace(/_/g, " ")} onPress={() => setOccasion(occasion === o.replace(/_/g, " ") ? "" : o.replace(/_/g, " "))} />
              ))}
            </ScrollView>
          </View>
          <View>
            <Label>Style</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {COMMON_STYLES.map((s) => (
                <Chip key={s} label={humanize(s)} active={style === s} onPress={() => setStyle(style === s ? "" : s)} />
              ))}
            </ScrollView>
          </View>
          <View>
            <Label>Season</Label>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {SEASONS.map((s) => (
                <Chip key={s} label={humanize(s)} active={season === s} onPress={() => setSeason(season === s ? "" : s)} />
              ))}
            </View>
          </View>
        </Card>

        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <SectionTitle style={{ marginBottom: 0 }}>Required items</SectionTitle>
            <Button title={required.length ? "Change" : "Add"} icon="add" size="sm" variant="ghost" onPress={() => { setChooserSel(new Set(required)); setChooser(true); }} />
          </View>
          {required.length === 0 ? (
            <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.input, borderRadius: radius.lg, padding: 16, marginTop: 6 }}>
              <Muted style={{ textAlign: "center" }}>Optional — pick an item to build the outfit around (e.g. your black jeans).</Muted>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingTop: 6 }}>
              {result.anchors.map((a) => (
                <View key={a.id} style={{ width: 124 }}>
                  <ClothingCard item={a} />
                  <View style={{ position: "absolute", top: 4, right: 4, backgroundColor: colors.background, borderRadius: 20 }}>
                    <IconButton icon="close" label={`Remove ${a.name}`} onPress={() => setRequired((r) => r.filter((x) => x !== a.id))} />
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {items.length === 0 && <Muted style={{ textAlign: "center" }}>Your wardrobe is empty — import clothes first.</Muted>}

        {OUTFIT_ROLES.filter((r) => result.groups[r].length > 0).map((role) => (
          <View key={role}>
            <SectionTitle>
              {OUTFIT_ROLE_LABELS[role]} <Text style={{ fontWeight: "400", color: colors.mutedForeground }}>· tap to pick</Text>
            </SectionTitle>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {result.groups[role].map((c) => (
                <View key={c.item.id} style={{ width: 124 }}>
                  <ClothingCard item={c.item} selectable selected={picked.has(c.item.id)} onPress={() => toggle(c.item.id)} note={c.reasons.slice(0, 2).join(" · ") || undefined} />
                </View>
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {items.length > 0 && (
        <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
          <Button title={`Save (${count})`} icon="bookmark-outline" variant="outline" style={{ flex: 1 }} disabled={count < 2} onPress={() => setSaveOpen(true)} />
          <Button title="Copy for Claude" icon="sparkles-outline" style={{ flex: 1.6 }} onPress={copyForClaude} />
        </View>
      )}

      <CopySheet
        visible={prompt !== null}
        onClose={() => setPrompt(null)}
        title="Ask Claude for an outfit"
        description="Share this to Claude. It lists only your real items with their IDs; paste Claude’s JSON reply into Import outfit."
        text={prompt ?? ""}
        filename="outfit-request.txt"
        extraFooter={
          <Button
            title="Import Claude’s answer"
            icon="code-download-outline"
            variant="outline"
            onPress={() => {
              setPrompt(null);
              router.push("/outfit-import");
            }}
          />
        }
      />

      <Sheet
        visible={chooser}
        onClose={() => setChooser(false)}
        title="Required items"
        description="Pick the items the outfit must include."
        tall
        scroll={false}
        footer={
          <Button
            title={`Use ${chooserSel.size} item${chooserSel.size === 1 ? "" : "s"}`}
            style={{ flex: 1 }}
            onPress={() => {
              setRequired([...chooserSel].slice(0, 20));
              setPicked((p) => new Set([...p].filter((id) => !chooserSel.has(id))));
              setChooser(false);
            }}
          />
        }
      >
        <View style={{ flex: 1, marginHorizontal: -16 }}>
          <WardrobeBrowser
            selectable
            selectedIds={chooserSel}
            onToggle={(id) =>
              setChooserSel((s) => {
                const n = new Set(s);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })
            }
          />
        </View>
      </Sheet>

      <Sheet visible={saveOpen} onClose={() => setSaveOpen(false)} title="Save outfit" description={`${count} pieces: required items plus your picks.`} footer={<Button title="Save outfit" style={{ flex: 1 }} loading={saving} onPress={save} />}>
        <Label>Name</Label>
        <Field value={name} onChangeText={setName} placeholder={occasion ? `${humanize(occasion)} outfit` : "Weekend outfit"} />
      </Sheet>
    </Screen>
  );
}
