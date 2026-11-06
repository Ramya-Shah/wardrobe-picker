import { Text, View } from "react-native";
import { CATEGORIES, categoryLabel, humanize, isKnownCategory, SUBCATEGORIES } from "@/lib/constants/categories";
import { COMMON_OCCASIONS, COMMON_STYLES, ENVIRONMENTS, FORMALITY_LEVELS, PAIRING_KEYS, SEASONS } from "@/lib/constants/vocab";
import type { ClothingItem, ClothingItemInput, EditableField } from "@/lib/types";
import { Chip, Field, Label } from "~/ui/primitives";
import { fonts, useColors } from "~/ui/theme";
import { ListInput } from "./list-input";
import { fieldOrigin, OriginMark } from "./provenance";

const COLORS = ["black", "white", "grey", "navy", "blue", "light blue", "beige", "cream", "brown", "tan", "olive", "green", "red", "burgundy", "pink", "purple", "yellow", "orange", "denim", "khaki", "multicolor"];

export function emptyClothingInput(): ClothingItemInput {
  return {
    name: "", category: "TOP", subcategory: null, primaryColor: null, secondaryColors: [], pattern: null, texture: null, graphic: null, logo: null,
    material: null, fit: null, sleeveType: null, neckline: null, length: null, silhouette: null, styles: [], formality: null, seasons: [], occasions: [],
    environments: [], tags: [], description: null, pairingSuggestions: { tops: [], bottoms: [], dresses: [], outerwear: [], shoes: [], accessories: [] }, userNotes: null,
  };
}

/** Full metadata editor (controlled). With `item`, labels show Claude's guesses and your edits. */
export function ClothingForm({
  value,
  onChange,
  item,
  nameError,
}: {
  value: ClothingItemInput;
  onChange: (v: ClothingItemInput) => void;
  item?: Pick<ClothingItem, "aiGenerated" | "editedFields" | "inferredFields">;
  nameError?: string | null;
}) {
  const colors = useColors();
  const set = <K extends EditableField>(k: K, v: ClothingItemInput[K]) => onChange({ ...value, [k]: v });
  const text = (k: EditableField) => (value[k] as string | null) ?? "";
  const setText = (k: EditableField, v: string) => set(k, (v.trim() ? v : null) as never);

  const L = (field: EditableField, label: string) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Label>{label}</Label>
      {item && <View style={{ marginBottom: 6 }}><OriginMark origin={fieldOrigin(item, field)} /></View>}
    </View>
  );
  const input = (field: EditableField, label: string, placeholder?: string) => (
    <View style={{ flex: 1, minWidth: "45%" }}>
      {L(field, label)}
      <Field value={text(field)} onChangeText={(t) => setText(field, t)} placeholder={placeholder} autoCapitalize="none" />
    </View>
  );
  const subcats = isKnownCategory(value.category) ? SUBCATEGORIES[value.category] : [];

  return (
    <View style={{ gap: 28 }}>
      <Group title="Basics">
        <View>
          {L("name", "Name")}
          <Field value={value.name} onChangeText={(t) => set("name", t)} placeholder="e.g. Black relaxed-fit jeans" style={nameError ? { borderColor: colors.destructive } : undefined} />
          {nameError ? <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4 }}>{nameError}</Text> : null}
        </View>
        <View>
          {L("category", "Category")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[...CATEGORIES, ...(isKnownCategory(value.category) ? [] : [value.category])].map((c) => (
              <Chip key={c} label={categoryLabel(c)} active={value.category === c} onPress={() => onChange({ ...value, category: c, subcategory: null })} />
            ))}
          </View>
        </View>
        <View>
          {L("subcategory", "Type")}
          <Field
            value={value.subcategory ?? ""}
            onChangeText={(t) => set("subcategory", t.trim() ? t.toLowerCase().replace(/[\s-]+/g, "_") : null)}
            placeholder="e.g. jeans"
            autoCapitalize="none"
          />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {subcats.filter((s) => s !== "other").map((s) => (
              <Chip key={s} label={humanize(s)} active={value.subcategory === s} onPress={() => set("subcategory", value.subcategory === s ? null : s)} />
            ))}
          </View>
        </View>
      </Group>

      <Group title="Colors">
        <View>
          {L("primaryColor", "Primary color")}
          <ListInput value={value.primaryColor ? [value.primaryColor] : []} onChange={(v) => set("primaryColor", v[v.length - 1] ?? null)} suggestions={COLORS} placeholder="e.g. black" />
        </View>
        <View>
          {L("secondaryColors", "Secondary colors")}
          <ListInput value={value.secondaryColors} onChange={(v) => set("secondaryColors", v)} suggestions={COLORS} />
        </View>
      </Group>

      <Group title="Appearance">
        <Row>
          {input("pattern", "Pattern", "solid, striped…")}
          {input("texture", "Texture", "smooth, ribbed…")}
        </Row>
        <Row>
          {input("graphic", "Graphic", "none")}
          {input("logo", "Logo", "none")}
        </Row>
      </Group>

      <Group title="Construction">
        <Row>
          {input("material", "Material", "cotton, denim…")}
          {input("fit", "Fit", "slim, relaxed…")}
        </Row>
        <Row>
          {input("sleeveType", "Sleeves", "short, full…")}
          {input("neckline", "Neckline", "crew, collar…")}
        </Row>
        <Row>
          {input("length", "Length", "cropped, ankle…")}
          {input("silhouette", "Silhouette", "straight, A-line…")}
        </Row>
      </Group>

      <Group title="Style">
        <View>
          {L("styles", "Style")}
          <ListInput value={value.styles} onChange={(v) => set("styles", v)} suggestions={COMMON_STYLES} />
        </View>
        <View>
          {L("formality", "Formality")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FORMALITY_LEVELS.map((f) => (
              <Chip key={f} label={humanize(f)} active={value.formality === f} onPress={() => set("formality", value.formality === f ? null : f)} />
            ))}
          </View>
        </View>
      </Group>

      <Group title="When & where">
        <View>
          {L("seasons", "Seasons")}
          <ListInput quickPick value={value.seasons} onChange={(v) => set("seasons", v)} suggestions={SEASONS} />
        </View>
        <View>
          {L("occasions", "Occasions")}
          <ListInput value={value.occasions} onChange={(v) => set("occasions", v)} suggestions={COMMON_OCCASIONS} />
        </View>
        <View>
          {L("environments", "Environments")}
          <ListInput quickPick value={value.environments} onChange={(v) => set("environments", v)} suggestions={ENVIRONMENTS} />
        </View>
      </Group>

      <Group title="Search">
        <View>
          {L("tags", "Tags")}
          <ListInput value={value.tags} onChange={(v) => set("tags", v)} placeholder="Add a tag…" />
        </View>
        <View>
          {L("description", "Description")}
          <Field multiline value={text("description")} onChangeText={(t) => setText("description", t)} />
        </View>
      </Group>

      <Group title="Pairs well with">
        {PAIRING_KEYS.map((k) => (
          <View key={k}>
            <Label>{humanize(k)}</Label>
            <ListInput value={value.pairingSuggestions[k]} onChange={(v) => set("pairingSuggestions", { ...value.pairingSuggestions, [k]: v })} placeholder={k === "shoes" ? "e.g. white sneakers" : "Add…"} />
          </View>
        ))}
      </Group>

      <Group title="Notes">
        <View>
          {L("userNotes", "My notes")}
          <Field multiline value={text("userNotes")} onChangeText={(t) => setText("userNotes", t)} placeholder="Size, where you bought it, how it fits…" />
        </View>
      </Group>
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 19, color: colors.foreground }}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", gap: 10 }}>{children}</View>;
}
