/**
 * Suggested vocabularies. These guide Claude (see docs/CLAUDE_WARDROBE_PROMPT.md)
 * and populate UI pickers, but any string is accepted.
 */

export const FORMALITY_LEVELS = [
  "very_casual",
  "casual",
  "smart_casual",
  "business_casual",
  "business",
  "formal",
  "black_tie",
] as const;

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

export const COMMON_OCCASIONS = [
  "casual",
  "college",
  "work",
  "office",
  "dinner",
  "date",
  "party",
  "travel",
  "gym",
  "sports",
  "lounge",
  "wedding",
  "festive",
  "formal_event",
  "beach",
] as const;

export const COMMON_STYLES = [
  "casual",
  "minimal",
  "classic",
  "streetwear",
  "smart",
  "sporty",
  "athleisure",
  "preppy",
  "bohemian",
  "vintage",
  "traditional",
  "formal",
  "edgy",
] as const;

export const ENVIRONMENTS = ["indoor", "outdoor"] as const;

export const OUTFIT_ROLES = ["TOP", "BOTTOM", "DRESS", "OUTERWEAR", "SHOES", "ACCESSORY"] as const;
export type OutfitRole = (typeof OUTFIT_ROLES)[number];

export const OUTFIT_ROLE_LABELS: Record<OutfitRole, string> = {
  TOP: "Top",
  BOTTOM: "Bottom",
  DRESS: "Dress",
  OUTERWEAR: "Outerwear",
  SHOES: "Shoes",
  ACCESSORY: "Accessory",
};

/** The outfit role an item naturally plays, derived from its category. */
export function roleForCategory(category: string): OutfitRole | null {
  switch (category) {
    case "TOP":
    case "BOTTOM":
    case "DRESS":
    case "OUTERWEAR":
    case "SHOES":
    case "ACCESSORY":
      return category;
    default:
      return null;
  }
}

export const PAIRING_KEYS = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
] as const;
export type PairingKey = (typeof PAIRING_KEYS)[number];

/** Values that mean "Claude could not tell" and are stored as null. */
export const UNKNOWN_VALUES = new Set(["", "unknown", "n/a", "na", "null", "undefined", "not visible", "unclear"]);
