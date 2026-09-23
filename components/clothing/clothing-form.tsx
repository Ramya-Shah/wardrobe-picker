"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, categoryLabel, humanize, isKnownCategory, SUBCATEGORIES } from "@/lib/constants/categories";
import { COMMON_OCCASIONS, COMMON_STYLES, ENVIRONMENTS, FORMALITY_LEVELS, PAIRING_KEYS, SEASONS } from "@/lib/constants/vocab";
import type { ClothingItem, ClothingItemInput, EditableField } from "@/lib/types";
import { ListInput } from "./list-input";
import { fieldOrigin, OriginMark } from "./provenance";

const COMMON_COLORS = [
  "black", "white", "grey", "navy", "blue", "light blue", "beige", "cream", "brown", "tan", "olive",
  "green", "red", "burgundy", "pink", "purple", "yellow", "orange", "denim", "khaki", "multicolor",
];

/**
 * Full metadata editor. Controlled: parent owns the value. When `item` is given,
 * each label shows whether the current value came from Claude or from the user.
 */
export function ClothingForm({
  value,
  onChange,
  item,
  errors = {},
}: {
  value: ClothingItemInput;
  onChange: (next: ClothingItemInput) => void;
  item?: Pick<ClothingItem, "aiGenerated" | "editedFields" | "inferredFields">;
  errors?: Partial<Record<EditableField, string>>;
}) {
  const uid = useId();
  const set = <K extends EditableField>(key: K, v: ClothingItemInput[K]) => onChange({ ...value, [key]: v });
  const text = (key: EditableField) => (value[key] as string | null) ?? "";
  const setText = (key: EditableField, v: string) => set(key, (v.trim() === "" ? null : v) as never);

  const F = ({ field, label, children }: { field: EditableField; label: string; children: React.ReactNode }) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${uid}-${field}`} className="flex items-center gap-1.5">
        {label}
        {item && <OriginMark origin={fieldOrigin(item, field)} />}
      </Label>
      {children}
      {errors[field] && <p className="text-xs text-destructive">{errors[field]}</p>}
    </div>
  );

  const textInput = (field: EditableField, placeholder?: string, list?: string) => (
    <Input id={`${uid}-${field}`} value={text(field)} onChange={(e) => setText(field, e.target.value)} placeholder={placeholder} list={list} />
  );

  const subcats = isKnownCategory(value.category) ? SUBCATEGORIES[value.category] : [];

  return (
    <div className="space-y-8">
      <Group title="Basics">
        {F({ field: "name", label: "Name", children: <Input id={`${uid}-name`} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Black relaxed-fit jeans" aria-invalid={Boolean(errors.name)} /> })}
        <div className="grid grid-cols-2 gap-3">
          {F({
            field: "category",
            label: "Category",
            children: (
              <NativeSelect id={`${uid}-category`} value={value.category} onChange={(e) => onChange({ ...value, category: e.target.value, subcategory: null })}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
                {!isKnownCategory(value.category) && <option value={value.category}>{humanize(value.category)}</option>}
              </NativeSelect>
            ),
          })}
          {F({
            field: "subcategory",
            label: "Type",
            children: (
              <>
                <Input
                  id={`${uid}-subcategory`}
                  value={value.subcategory ?? ""}
                  list={`${uid}-subcats`}
                  onChange={(e) => set("subcategory", e.target.value.trim() ? e.target.value.toLowerCase().replace(/[\s-]+/g, "_") : null)}
                  placeholder="e.g. jeans"
                />
                <datalist id={`${uid}-subcats`}>
                  {subcats.map((s) => (
                    <option key={s} value={s}>
                      {humanize(s)}
                    </option>
                  ))}
                </datalist>
              </>
            ),
          })}
        </div>
      </Group>

      <Group title="Colors">
        {F({ field: "primaryColor", label: "Primary color", children: textInput("primaryColor", "e.g. black", `${uid}-colors`) })}
        <datalist id={`${uid}-colors`}>
          {COMMON_COLORS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {F({ field: "secondaryColors", label: "Secondary colors", children: <ListInput value={value.secondaryColors} onChange={(v) => set("secondaryColors", v)} suggestions={COMMON_COLORS} /> })}
      </Group>

      <Group title="Appearance">
        <div className="grid grid-cols-2 gap-3">
          {F({ field: "pattern", label: "Pattern", children: textInput("pattern", "solid, striped…") })}
          {F({ field: "texture", label: "Texture", children: textInput("texture", "smooth, ribbed…") })}
          {F({ field: "graphic", label: "Graphic", children: textInput("graphic", "none") })}
          {F({ field: "logo", label: "Logo", children: textInput("logo", "none") })}
        </div>
      </Group>

      <Group title="Construction">
        <div className="grid grid-cols-2 gap-3">
          {F({ field: "material", label: "Material", children: textInput("material", "cotton, denim…") })}
          {F({ field: "fit", label: "Fit", children: textInput("fit", "slim, relaxed…") })}
          {F({ field: "sleeveType", label: "Sleeves", children: textInput("sleeveType", "short, full…") })}
          {F({ field: "neckline", label: "Neckline", children: textInput("neckline", "crew, collar…") })}
          {F({ field: "length", label: "Length", children: textInput("length", "cropped, ankle…") })}
          {F({ field: "silhouette", label: "Silhouette", children: textInput("silhouette", "straight, A-line…") })}
        </div>
      </Group>

      <Group title="Style">
        {F({ field: "styles", label: "Style", children: <ListInput value={value.styles} onChange={(v) => set("styles", v)} suggestions={COMMON_STYLES} /> })}
        {F({
          field: "formality",
          label: "Formality",
          children: (
            <NativeSelect id={`${uid}-formality`} value={value.formality ?? ""} onChange={(e) => set("formality", e.target.value || null)}>
              <option value="">Not set</option>
              {FORMALITY_LEVELS.map((f) => (
                <option key={f} value={f}>
                  {humanize(f)}
                </option>
              ))}
              {value.formality && !(FORMALITY_LEVELS as readonly string[]).includes(value.formality) && (
                <option value={value.formality}>{humanize(value.formality)}</option>
              )}
            </NativeSelect>
          ),
        })}
      </Group>

      <Group title="When & where">
        {F({ field: "seasons", label: "Seasons", children: <ListInput quickPick value={value.seasons} onChange={(v) => set("seasons", v)} suggestions={SEASONS} /> })}
        {F({ field: "occasions", label: "Occasions", children: <ListInput value={value.occasions} onChange={(v) => set("occasions", v)} suggestions={COMMON_OCCASIONS} /> })}
        {F({ field: "environments", label: "Environments", children: <ListInput quickPick value={value.environments} onChange={(v) => set("environments", v)} suggestions={ENVIRONMENTS} /> })}
      </Group>

      <Group title="Search">
        {F({ field: "tags", label: "Tags", children: <ListInput value={value.tags} onChange={(v) => set("tags", v)} placeholder="Add a tag…" /> })}
        {F({
          field: "description",
          label: "Description",
          children: <Textarea id={`${uid}-description`} value={text("description")} onChange={(e) => setText("description", e.target.value)} rows={4} />,
        })}
      </Group>

      <Group title="Pairs well with">
        {PAIRING_KEYS.map((k) => (
          <div key={k} className="space-y-1.5">
            <Label>{humanize(k)}</Label>
            <ListInput
              value={value.pairingSuggestions[k]}
              onChange={(v) => set("pairingSuggestions", { ...value.pairingSuggestions, [k]: v })}
              placeholder={k === "shoes" ? "e.g. white sneakers" : "Add…"}
            />
          </div>
        ))}
      </Group>

      <Group title="Notes">
        {F({
          field: "userNotes",
          label: "My notes",
          children: (
            <Textarea
              id={`${uid}-userNotes`}
              value={text("userNotes")}
              onChange={(e) => setText("userNotes", e.target.value)}
              rows={3}
              placeholder="Size, where you bought it, how it fits…"
            />
          ),
        })}
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 font-serif text-lg">{title}</legend>
      {children}
    </fieldset>
  );
}

export function emptyClothingInput(): ClothingItemInput {
  return {
    name: "",
    category: "TOP",
    subcategory: null,
    primaryColor: null,
    secondaryColors: [],
    pattern: null,
    texture: null,
    graphic: null,
    logo: null,
    material: null,
    fit: null,
    sleeveType: null,
    neckline: null,
    length: null,
    silhouette: null,
    styles: [],
    formality: null,
    seasons: [],
    occasions: [],
    environments: [],
    tags: [],
    description: null,
    pairingSuggestions: { tops: [], bottoms: [], dresses: [], outerwear: [], shoes: [], accessories: [] },
    userNotes: null,
  };
}
