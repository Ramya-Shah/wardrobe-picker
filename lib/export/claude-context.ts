import { categoryLabel, humanize } from "@/lib/constants/categories";
import { OUTFIT_ROLES, PAIRING_KEYS } from "@/lib/constants/vocab";
import type { ClothingItem } from "@/lib/types";

/**
 * Export wardrobe items as compact context for Claude Chat.
 * Claude must reference items only by the IDs printed here.
 */

const title = (values: (string | null | undefined)[]) =>
  values
    .filter((v): v is string => Boolean(v))
    .map((v) => humanize(v))
    .join(", ");

export function formatItemAsText(item: ClothingItem): string {
  const lines: string[] = [`CLOTHING ITEM: ${item.id}`, `Name: ${item.name}`];
  const push = (label: string, value: string | null | undefined) => {
    if (value) lines.push(`${label}: ${value}`);
  };
  push("Category", `${item.category}${item.subcategory ? ` / ${item.subcategory}` : ""}`);
  push("Color", title([item.primaryColor, ...item.secondaryColors]));
  push("Pattern", humanize(item.pattern));
  push("Texture", humanize(item.texture));
  push("Graphic", item.graphic);
  push("Logo", item.logo);
  push("Material", humanize(item.material));
  push("Fit", humanize(item.fit));
  push("Sleeves", humanize(item.sleeveType));
  push("Neckline", humanize(item.neckline));
  push("Length", humanize(item.length));
  push("Silhouette", humanize(item.silhouette));
  push("Style", title(item.styles));
  push("Formality", humanize(item.formality));
  push("Seasons", title(item.seasons));
  push("Occasions", title(item.occasions));
  push("Tags", item.tags.join(", "));
  push("Description", item.description);
  const pairing = PAIRING_KEYS.filter((k) => item.pairingSuggestions[k]?.length)
    .map((k) => `${k}: ${item.pairingSuggestions[k].join(", ")}`)
    .join("; ");
  push("Pairs with", pairing);
  push("Owner notes", item.userNotes);
  return lines.join("\n");
}

export function formatItemsAsText(items: ClothingItem[]): string {
  return items.map(formatItemAsText).join("\n\n");
}

/** Compact JSON context (stable keys, nulls/empties omitted). */
export function itemToContextJson(item: ClothingItem): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: item.id,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    colors: [item.primaryColor, ...item.secondaryColors].filter(Boolean),
    pattern: item.pattern,
    material: item.material,
    fit: item.fit,
    style: item.styles,
    formality: item.formality,
    seasons: item.seasons,
    occasions: item.occasions,
    tags: item.tags,
    description: item.description,
    pairingSuggestions: Object.fromEntries(PAIRING_KEYS.filter((k) => item.pairingSuggestions[k]?.length).map((k) => [k, item.pairingSuggestions[k]])),
    notes: item.userNotes,
  };
  for (const [k, v] of Object.entries(out)) {
    if (v === null || v === undefined || (Array.isArray(v) && v.length === 0) || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0)) {
      delete out[k];
    }
  }
  return out;
}

export function formatItemsAsJson(items: ClothingItem[]): string {
  return JSON.stringify({ wardrobe: items.map(itemToContextJson) }, null, 2);
}

export interface OutfitRequest {
  occasion?: string | null;
  style?: string | null;
  season?: string | null;
  requiredIds?: string[];
  notes?: string | null;
}

export const OUTFIT_RESPONSE_EXAMPLE = {
  name: "Casual Dinner",
  occasion: "casual dinner",
  season: "summer",
  style: "minimal",
  items: [
    { clothingItemId: "itm_xxxxxxxx", role: "TOP" },
    { clothingItemId: "itm_yyyyyyyy", role: "BOTTOM" },
    { clothingItemId: "itm_zzzzzzzz", role: "SHOES" },
  ],
  explanation: "Why these pieces work together.",
};

/** Full prompt to paste into Claude: request + rules + wardrobe context + response schema. */
export function buildOutfitPrompt(items: ClothingItem[], request: OutfitRequest, format: "text" | "json" = "text"): string {
  const required = items.filter((i) => request.requiredIds?.includes(i.id));
  const wants: string[] = [];
  if (request.occasion) wants.push(`Occasion: ${request.occasion}`);
  if (request.style) wants.push(`Style: ${request.style}`);
  if (request.season) wants.push(`Season: ${request.season}`);
  if (required.length) wants.push(`Must include: ${required.map((i) => `${i.name} (${i.id})`).join(", ")}`);
  if (request.notes) wants.push(`Notes: ${request.notes}`);

  return [
    "You are my personal stylist. Build an outfit using ONLY the clothing items listed in MY WARDROBE below.",
    "",
    "REQUEST",
    wants.length ? wants.join("\n") : "Suggest a good everyday outfit.",
    "",
    "RULES",
    "- Reference items ONLY by their exact clothingItemId (e.g. itm_ab12cd34). Never invent IDs or items.",
    `- Allowed roles: ${OUTFIT_ROLES.join(", ")}. Use a DRESS instead of TOP + BOTTOM, not both.`,
    "- Include at most one item per role, except ACCESSORY (up to 3).",
    "- If the wardrobe lacks something important, say so in the explanation instead of inventing it.",
    "- Reply with valid JSON only (no markdown, no commentary), exactly in this shape:",
    JSON.stringify(OUTFIT_RESPONSE_EXAMPLE, null, 2),
    "- To offer alternatives, return {\"outfits\": [ ...up to 3 outfits in the same shape... ]}.",
    "",
    `MY WARDROBE (${items.length} items)`,
    format === "json" ? formatItemsAsJson(items) : formatItemsAsText(items),
  ].join("\n");
}

export function categorySummary(items: ClothingItem[]): string {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
  return [...counts.entries()].map(([c, n]) => `${n} ${categoryLabel(c, n !== 1).toLowerCase()}`).join(", ");
}
