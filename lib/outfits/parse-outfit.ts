import { parseJsonText } from "@/lib/import/parse-claude-json";
import { roleForCategory } from "@/lib/constants/vocab";
import { formatZodIssues } from "@/lib/validation/primitives";
import { outfitImportSchema, type OutfitImport } from "@/lib/validation/outfit";

export interface ParsedOutfit {
  index: number;
  ok: boolean;
  outfit: OutfitImport | null;
  label: string;
  errors: string[];
  warnings: string[];
  raw: unknown;
}

export interface OutfitParseResult {
  fatal: string | null;
  outfits: ParsedOutfit[];
}

/** Accepts a single outfit object, {"outfits": [...]}, or an array of outfits. */
export function parseOutfitImport(input: string | unknown): OutfitParseResult {
  let value: unknown = input;
  if (typeof input === "string") {
    const parsed = parseJsonText(input);
    if (parsed.error) return { fatal: parsed.error, outfits: [] };
    value = parsed.value;
  }
  let rawList: unknown[];
  if (Array.isArray(value)) rawList = value;
  else if (value && typeof value === "object" && Array.isArray((value as { outfits?: unknown }).outfits)) {
    rawList = (value as { outfits: unknown[] }).outfits;
  } else if (value && typeof value === "object") rawList = [value];
  else return { fatal: "Expected an outfit JSON object.", outfits: [] };
  if (rawList.length === 0) return { fatal: "No outfits found in the JSON.", outfits: [] };
  if (rawList.length > 50) return { fatal: "Too many outfits in one import (max 50).", outfits: [] };

  return {
    fatal: null,
    outfits: rawList.map((raw, index) => {
      const label =
        raw && typeof raw === "object" && typeof (raw as { name?: unknown }).name === "string"
          ? (raw as { name: string }).name
          : `Outfit #${index + 1}`;
      const result = outfitImportSchema.safeParse(raw);
      if (!result.success) {
        return { index, ok: false, outfit: null, label, errors: formatZodIssues(result.error), warnings: [], raw };
      }
      return { index, ok: true, outfit: result.data, label: result.data.name, errors: [], warnings: [], raw };
    }),
  };
}

export interface KnownItem {
  id: string;
  name: string;
  category: string;
}

/**
 * Check every clothing reference against the wardrobe. Unknown IDs are errors (the outfit is
 * rejected); questionable combinations are warnings.
 */
export function validateOutfitReferences(outfit: OutfitImport, known: Map<string, KnownItem>): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  for (const ref of outfit.items) {
    if (seen.has(ref.clothingItemId)) {
      errors.push(`"${ref.clothingItemId}" is listed more than once.`);
      continue;
    }
    seen.add(ref.clothingItemId);
    const item = known.get(ref.clothingItemId);
    if (!item) {
      errors.push(`Unknown clothing ID "${ref.clothingItemId}" — it does not exist in your wardrobe.`);
      continue;
    }
    const natural = roleForCategory(item.category);
    if (natural && natural !== ref.role && !(natural === "TOP" && ref.role === "OUTERWEAR") && !(natural === "OUTERWEAR" && ref.role === "TOP")) {
      warnings.push(`"${item.name}" is a ${item.category.toLowerCase()} but is used as ${ref.role.toLowerCase()}.`);
    }
  }
  const roles = outfit.items.map((i) => i.role);
  if (roles.includes("DRESS") && (roles.includes("TOP") || roles.includes("BOTTOM"))) {
    warnings.push("The outfit combines a dress with a top or bottom.");
  }
  if (roles.filter((r) => r === "SHOES").length > 1) warnings.push("The outfit has more than one pair of shoes.");
  return { errors, warnings };
}
