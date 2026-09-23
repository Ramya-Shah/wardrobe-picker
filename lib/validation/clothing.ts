import { z } from "zod";
import { normalizeCategory, normalizeSubcategory } from "@/lib/constants/categories";
import { PAIRING_KEYS } from "@/lib/constants/vocab";
import { fieldFromClaudePath } from "@/lib/constants/fields";
import type { ClothingItemInput, EditableField, PairingSuggestions } from "@/lib/types";
import { nullableAttr, nullableLongText, nullableText, nullableToken, textList } from "./primitives";

/** Current version of the Claude wardrobe JSON contract. Bump only for breaking changes. */
export const CLAUDE_SCHEMA_VERSION = 1;

const categoryField = z
  .preprocess((v) => (typeof v === "string" || v == null ? normalizeCategory(v as string | null) : v), z.string().min(1).max(50))
  .default("OTHER");

const subcategoryField = z
  .preprocess((v) => (typeof v === "string" || v == null ? normalizeSubcategory(v as string | null) : v), z.string().max(50).nullable())
  .default(null);

export const pairingSuggestionsSchema = z
  .preprocess(
    (v) => (v === null || v === undefined ? {} : v),
    z.object({
      tops: textList,
      bottoms: textList,
      dresses: textList,
      outerwear: textList,
      shoes: textList,
      accessories: textList,
    }),
  )
  .default({ tops: [], bottoms: [], dresses: [], outerwear: [], shoes: [], accessories: [] });

const colorsSchema = z
  .preprocess(
    (v) => {
      if (v === null || v === undefined) return {};
      if (typeof v === "string") return { primary: v };
      if (Array.isArray(v)) return { primary: v[0] ?? null, secondary: v.slice(1) };
      return v;
    },
    z.object({ primary: nullableAttr, secondary: textList }),
  )
  .default({ primary: null, secondary: [] });

const appearanceSchema = z
  .preprocess(
    (v) => (v == null ? {} : v),
    z.object({ pattern: nullableAttr, texture: nullableAttr, graphic: nullableText, logo: nullableText }),
  )
  .default({ pattern: null, texture: null, graphic: null, logo: null });

const constructionSchema = z
  .preprocess(
    (v) => (v == null ? {} : v),
    z.object({
      material: nullableAttr,
      fit: nullableAttr,
      sleeveType: nullableAttr,
      neckline: nullableAttr,
      length: nullableAttr,
      silhouette: nullableAttr,
    }),
  )
  .default({ material: null, fit: null, sleeveType: null, neckline: null, length: null, silhouette: null });

/**
 * One clothing item exactly as Claude produces it (see docs/CLAUDE_WARDROBE_PROMPT.md).
 * Lenient about value formatting, strict about structure.
 */
export const claudeClothingItemSchema = z.object({
  image: z
    .preprocess((v) => (typeof v === "string" ? v.trim() || null : v ?? null), z.string().max(255).nullable())
    .default(null),
  name: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1, "name is required").max(200)),
  category: categoryField,
  subcategory: subcategoryField,
  colors: colorsSchema,
  appearance: appearanceSchema,
  construction: constructionSchema,
  style: textList,
  formality: nullableToken,
  seasons: textList,
  occasions: textList,
  environments: textList,
  tags: textList,
  description: nullableLongText,
  pairingSuggestions: pairingSuggestionsSchema,
  inferredFields: textList,
  notes: nullableLongText,
});

export type ClaudeClothingItem = z.infer<typeof claudeClothingItemSchema>;

/** The flat, app-internal metadata shape (API inputs, edit form, restore). */
export const clothingItemInputSchema = z.object({
  name: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1, "Name is required").max(200)),
  category: categoryField,
  subcategory: subcategoryField,
  primaryColor: nullableAttr,
  secondaryColors: textList,
  pattern: nullableAttr,
  texture: nullableAttr,
  graphic: nullableText,
  logo: nullableText,
  material: nullableAttr,
  fit: nullableAttr,
  sleeveType: nullableAttr,
  neckline: nullableAttr,
  length: nullableAttr,
  silhouette: nullableAttr,
  styles: textList,
  formality: nullableToken,
  seasons: textList,
  occasions: textList,
  environments: textList,
  tags: textList,
  description: nullableLongText,
  pairingSuggestions: pairingSuggestionsSchema,
  userNotes: nullableLongText,
}) satisfies z.ZodType<ClothingItemInput, unknown>;

/** PATCH payload: any subset of editable fields. Absent keys are left untouched. */
export const clothingItemPatchSchema = clothingItemInputSchema.partial();

export function claudeItemToInput(item: ClaudeClothingItem): ClothingItemInput {
  const pairing: PairingSuggestions = { ...item.pairingSuggestions };
  return {
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    primaryColor: item.colors.primary,
    secondaryColors: item.colors.secondary.filter((c) => c !== item.colors.primary),
    pattern: item.appearance.pattern,
    texture: item.appearance.texture,
    graphic: item.appearance.graphic,
    logo: item.appearance.logo,
    material: item.construction.material,
    fit: item.construction.fit,
    sleeveType: item.construction.sleeveType,
    neckline: item.construction.neckline,
    length: item.construction.length,
    silhouette: item.construction.silhouette,
    styles: item.style,
    formality: item.formality,
    seasons: item.seasons,
    occasions: item.occasions,
    environments: item.environments,
    tags: item.tags,
    description: item.description,
    pairingSuggestions: pairing,
    userNotes: item.notes,
  };
}

/** Convert app metadata back into the canonical Claude format (used by exports). */
export function inputToClaudeItem(
  input: ClothingItemInput,
  extra: { image?: string | null; inferredFields?: string[] } = {},
): ClaudeClothingItem {
  return {
    image: extra.image ?? null,
    name: input.name,
    category: input.category,
    subcategory: input.subcategory,
    colors: { primary: input.primaryColor, secondary: input.secondaryColors },
    appearance: { pattern: input.pattern, texture: input.texture, graphic: input.graphic, logo: input.logo },
    construction: {
      material: input.material,
      fit: input.fit,
      sleeveType: input.sleeveType,
      neckline: input.neckline,
      length: input.length,
      silhouette: input.silhouette,
    },
    style: input.styles,
    formality: input.formality,
    seasons: input.seasons,
    occasions: input.occasions,
    environments: input.environments,
    tags: input.tags,
    description: input.description,
    pairingSuggestions: Object.fromEntries(PAIRING_KEYS.map((k) => [k, input.pairingSuggestions[k] ?? []])) as PairingSuggestions,
    inferredFields: extra.inferredFields ?? [],
    notes: input.userNotes,
  };
}

/** Normalize Claude's `inferredFields` ("construction.material", "style"…) to app field names. */
export function normalizeInferredFields(paths: string[]): EditableField[] {
  const out: EditableField[] = [];
  for (const p of paths) {
    const field = fieldFromClaudePath(p);
    if (field && !out.includes(field)) out.push(field);
  }
  return out;
}
