/**
 * Category system.
 *
 * Categories and subcategories are stored as plain strings so that unknown
 * values produced by Claude (or typed by the user) are always accepted.
 * The lists below drive the UI and normalization, they are not a whitelist.
 */

export const CATEGORIES = [
  "TOP",
  "BOTTOM",
  "DRESS",
  "OUTERWEAR",
  "SHOES",
  "ACCESSORY",
  "OTHER",
] as const;

export type KnownCategory = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<KnownCategory, { singular: string; plural: string }> = {
  TOP: { singular: "Top", plural: "Tops" },
  BOTTOM: { singular: "Bottom", plural: "Bottoms" },
  DRESS: { singular: "Dress", plural: "Dresses" },
  OUTERWEAR: { singular: "Outerwear", plural: "Outerwear" },
  SHOES: { singular: "Shoes", plural: "Shoes" },
  ACCESSORY: { singular: "Accessory", plural: "Accessories" },
  OTHER: { singular: "Other", plural: "Other" },
};

export const SUBCATEGORIES: Record<KnownCategory, readonly string[]> = {
  TOP: [
    "tshirt",
    "shirt",
    "overshirt",
    "polo",
    "tank_top",
    "crop_top",
    "sweatshirt",
    "hoodie",
    "sweater",
    "cardigan",
    "kurta",
    "blouse",
    "other",
  ],
  BOTTOM: [
    "jeans",
    "trousers",
    "chinos",
    "cargo",
    "shorts",
    "joggers",
    "sweatpants",
    "skirt",
    "leggings",
    "other",
  ],
  DRESS: ["casual_dress", "formal_dress", "midi", "maxi", "mini", "traditional", "other"],
  OUTERWEAR: [
    "jacket",
    "blazer",
    "coat",
    "overshirt",
    "windbreaker",
    "bomber",
    "cardigan",
    "other",
  ],
  SHOES: [
    "sneakers",
    "running_shoes",
    "formal_shoes",
    "loafers",
    "boots",
    "sandals",
    "slippers",
    "heels",
    "flats",
    "other",
  ],
  ACCESSORY: ["watch", "belt", "bag", "cap", "hat", "sunglasses", "jewelry", "scarf", "other"],
  OTHER: ["other"],
};

const CATEGORY_ALIASES: Record<string, KnownCategory> = {
  TOP: "TOP",
  TOPS: "TOP",
  SHIRT: "TOP",
  SHIRTS: "TOP",
  UPPER: "TOP",
  BOTTOM: "BOTTOM",
  BOTTOMS: "BOTTOM",
  PANTS: "BOTTOM",
  TROUSERS: "BOTTOM",
  DRESS: "DRESS",
  DRESSES: "DRESS",
  OUTERWEAR: "OUTERWEAR",
  OUTER: "OUTERWEAR",
  JACKET: "OUTERWEAR",
  JACKETS: "OUTERWEAR",
  COAT: "OUTERWEAR",
  COATS: "OUTERWEAR",
  SHOE: "SHOES",
  SHOES: "SHOES",
  FOOTWEAR: "SHOES",
  ACCESSORY: "ACCESSORY",
  ACCESSORIES: "ACCESSORY",
  OTHER: "OTHER",
};

const SUBCATEGORY_ALIASES: Record<string, string> = {
  t_shirt: "tshirt",
  tee: "tshirt",
  tees: "tshirt",
  t_shirts: "tshirt",
  tshirts: "tshirt",
  tank: "tank_top",
  jumper: "sweater",
  pullover: "sweater",
  pants: "trousers",
  sweat_pants: "sweatpants",
  track_pants: "joggers",
  cargos: "cargo",
  cargo_pants: "cargo",
  sneaker: "sneakers",
  trainers: "sneakers",
  running_shoe: "running_shoes",
  boot: "boots",
  sandal: "sandals",
  loafer: "loafers",
  sunglass: "sunglasses",
  jewellery: "jewelry",
};

export function isKnownCategory(value: string): value is KnownCategory {
  return (CATEGORIES as readonly string[]).includes(value);
}

/** Normalize a category string. Unknown categories are preserved (uppercased), never rejected. */
export function normalizeCategory(value: string | null | undefined): string {
  if (!value) return "OTHER";
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (!key) return "OTHER";
  return CATEGORY_ALIASES[key] ?? key;
}

/** Normalize a subcategory into lower snake_case, mapping common aliases. */
export function normalizeSubcategory(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[\s\-/]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!key || key === "unknown") return null;
  return SUBCATEGORY_ALIASES[key] ?? key;
}

export function isKnownSubcategory(category: string, subcategory: string): boolean {
  if (!isKnownCategory(category)) return false;
  return SUBCATEGORIES[category].includes(subcategory);
}

export function categoryLabel(category: string, plural = false): string {
  if (isKnownCategory(category)) {
    return plural ? CATEGORY_LABELS[category].plural : CATEGORY_LABELS[category].singular;
  }
  return humanize(category);
}

/** "tank_top" → "Tank top", "SHOES" → "Shoes" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const spaced = value.replace(/_/g, " ").trim();
  if (!spaced) return "";
  const lower = spaced === spaced.toUpperCase() ? spaced.toLowerCase() : spaced;
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
