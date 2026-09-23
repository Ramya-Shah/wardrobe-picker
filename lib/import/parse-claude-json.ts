import { isKnownCategory, isKnownSubcategory } from "@/lib/constants/categories";
import { formatZodIssues } from "@/lib/validation/primitives";
import {
  claudeClothingItemSchema,
  claudeItemToInput,
  normalizeInferredFields,
  type ClaudeClothingItem,
} from "@/lib/validation/clothing";
import type { ClothingItemInput, EditableField } from "@/lib/types";

export interface ParsedImportItem {
  /** 0-based position in the imported JSON. */
  index: number;
  ok: boolean;
  /** Image filename/reference from the JSON (`image`), if any. */
  image: string | null;
  /** Name as found in the raw JSON (for error messages even when invalid). */
  label: string;
  input: ClothingItemInput | null;
  /** For invalid items: the valid parts of Claude's JSON, as a starting point for fixing it by hand. */
  draft: ClothingItemInput | null;
  inferredFields: EditableField[];
  errors: string[];
  warnings: string[];
  /** The verbatim object Claude produced, kept for auditing. */
  raw: unknown;
}

export interface ParseResult {
  ok: boolean;
  /** Set when the whole document is unusable (invalid JSON, wrong top-level shape…). */
  fatal: string | null;
  schemaVersion: number | null;
  items: ParsedImportItem[];
}

/** Remove markdown code fences and surrounding prose that chat UIs often add. */
export function extractJsonText(text: string): string {
  let t = text.trim().replace(/^﻿/, "");
  const fence = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  if (!t.startsWith("{") && !t.startsWith("[")) {
    const first = t.search(/[[{]/);
    if (first >= 0) t = t.slice(first);
  }
  return t;
}

export function parseJsonText(text: string): { value: unknown; error: string | null } {
  const cleaned = extractJsonText(text);
  if (!cleaned) return { value: null, error: "The JSON is empty." };
  try {
    return { value: JSON.parse(cleaned), error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { value: null, error: `Invalid JSON: ${message}` };
  }
}

function labelFor(raw: unknown, index: number): string {
  if (raw && typeof raw === "object" && "name" in raw && typeof (raw as { name: unknown }).name === "string") {
    return (raw as { name: string }).name;
  }
  return `Item #${index + 1}`;
}

function warningsFor(item: ClaudeClothingItem): string[] {
  const warnings: string[] = [];
  if (!isKnownCategory(item.category)) {
    warnings.push(`Unknown category "${item.category}" — it will be kept as-is.`);
  } else if (item.subcategory && !isKnownSubcategory(item.category, item.subcategory)) {
    warnings.push(`New subcategory "${item.subcategory}" for ${item.category} — it will be kept as-is.`);
  }
  if (!item.colors.primary) warnings.push("No primary color.");
  if (!item.description) warnings.push("No description.");
  return warnings;
}

/**
 * Salvage what is valid from an invalid item: drop the top-level keys that failed and
 * re-parse with a placeholder name. Used to pre-fill the "fix" form in the import preview.
 */
export function salvageDraft(raw: Record<string, unknown>): ClothingItemInput | null {
  const obj: Record<string, unknown> = { ...raw };
  const hadName = typeof obj.name === "string" && obj.name.trim() !== "";
  if (!hadName) obj.name = "_";
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = claudeClothingItemSchema.safeParse(obj);
    if (r.success) {
      const input = claudeItemToInput(r.data);
      return hadName ? input : { ...input, name: "" };
    }
    const bad = new Set(r.error.issues.map((i) => String(i.path[0] ?? "")));
    if (bad.has("")) return null;
    for (const key of bad) {
      if (key === "name") obj.name = "_";
      else delete obj[key];
    }
  }
  return null;
}

/** Validate a single already-parsed clothing object. */
export function validateClaudeItem(raw: unknown, index = 0): ParsedImportItem {
  const label = labelFor(raw, index);
  const image =
    raw && typeof raw === "object" && typeof (raw as { image?: unknown }).image === "string"
      ? ((raw as { image: string }).image.trim() || null)
      : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { index, ok: false, image, label, input: null, draft: null, inferredFields: [], errors: ["Each item must be a JSON object."], warnings: [], raw };
  }
  const result = claudeClothingItemSchema.safeParse(raw);
  if (!result.success) {
    const draft = salvageDraft(raw as Record<string, unknown>);
    return { index, ok: false, image, label, input: null, draft, inferredFields: [], errors: formatZodIssues(result.error), warnings: [], raw };
  }
  return {
    index,
    ok: true,
    image: result.data.image,
    label: result.data.name,
    input: claudeItemToInput(result.data),
    draft: null,
    inferredFields: normalizeInferredFields(result.data.inferredFields),
    errors: [],
    warnings: warningsFor(result.data),
    raw,
  };
}

/**
 * Parse Claude's wardrobe JSON. Accepted top-level shapes:
 *   { "schemaVersion": 1, "items": [ ... ] }   (canonical)
 *   [ ... ]                                    (bare array)
 *   { "name": ..., ... }                       (single item)
 */
export function parseClaudeImport(input: string | unknown): ParseResult {
  let value: unknown = input;
  if (typeof input === "string") {
    const parsed = parseJsonText(input);
    if (parsed.error) return { ok: false, fatal: parsed.error, schemaVersion: null, items: [] };
    value = parsed.value;
  }

  let rawItems: unknown[];
  let schemaVersion: number | null = null;
  if (Array.isArray(value)) {
    rawItems = value;
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.schemaVersion === "number") schemaVersion = obj.schemaVersion;
    if (Array.isArray(obj.items)) rawItems = obj.items;
    else if ("items" in obj) {
      return { ok: false, fatal: '"items" must be an array of clothing objects.', schemaVersion, items: [] };
    } else if ("name" in obj) rawItems = [obj];
    else {
      return {
        ok: false,
        fatal: 'Expected {"items": [...]}, an array of items, or a single item object with a "name".',
        schemaVersion,
        items: [],
      };
    }
  } else {
    return { ok: false, fatal: "Expected a JSON object or array.", schemaVersion: null, items: [] };
  }

  if (rawItems.length === 0) return { ok: false, fatal: "The JSON contains no items.", schemaVersion, items: [] };
  if (rawItems.length > 2000) return { ok: false, fatal: "Too many items in one import (max 2000).", schemaVersion, items: [] };

  const items = rawItems.map((raw, i) => validateClaudeItem(raw, i));

  // Flag duplicate image references inside the same JSON.
  const seen = new Map<string, number>();
  for (const item of items) {
    if (!item.image) continue;
    const key = item.image.toLowerCase();
    const prev = seen.get(key);
    if (prev !== undefined) {
      item.ok = false;
      item.errors.push(`Image "${item.image}" is also used by item #${prev + 1}. Each item needs its own image.`);
    } else seen.set(key, item.index);
  }

  return { ok: items.every((i) => i.ok), fatal: null, schemaVersion, items };
}
