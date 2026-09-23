import { OUTFIT_ROLES, roleForCategory, type OutfitRole, type PairingKey } from "@/lib/constants/vocab";
import { normalizeText } from "@/lib/search/search-text";
import { scoreItem, tokenizeQuery } from "@/lib/search/structured-search";
import type { ClothingItem } from "@/lib/types";

/**
 * Outfit Picker foundation (no AI): rank wardrobe items that could complete an outfit for
 * the chosen occasion/style/season around required "anchor" items. The ranked candidates
 * are what gets exported to Claude, which makes the final choice.
 */

export interface PickerCriteria {
  occasion?: string | null;
  style?: string | null;
  season?: string | null;
  requiredIds?: string[];
}

export interface PickerCandidate {
  item: ClothingItem;
  score: number;
  reasons: string[];
}

export interface PickerResult {
  anchors: ClothingItem[];
  groups: Record<OutfitRole, PickerCandidate[]>;
}

const PAIRING_KEY_FOR_ROLE: Record<OutfitRole, PairingKey> = {
  TOP: "tops",
  BOTTOM: "bottoms",
  DRESS: "dresses",
  OUTERWEAR: "outerwear",
  SHOES: "shoes",
  ACCESSORY: "accessories",
};

/** Fraction (0..1) of criterion words found in the item's values. */
function overlap(criterion: string | null | undefined, values: (string | null)[]): number {
  if (!criterion) return 0;
  const wanted = normalizeText(criterion).split(" ").filter((w) => w.length > 1);
  if (!wanted.length) return 0;
  const words = new Set(values.flatMap((v) => (v ? normalizeText(v).split(" ") : [])));
  return wanted.filter((w) => words.has(w)).length / wanted.length;
}

/** Does any pairing phrase (e.g. "black jeans") describe this item? */
function pairingMatches(phrases: string[], item: ClothingItem): string | null {
  for (const phrase of phrases) {
    const tokens = tokenizeQuery(phrase);
    if (tokens.length && scoreItem(item, tokens) > 0) return phrase;
  }
  return null;
}

export function scoreCandidate(item: ClothingItem, criteria: PickerCriteria, anchors: ClothingItem[]): PickerCandidate {
  let score = 0;
  const reasons: string[] = [];
  const occ = overlap(criteria.occasion, item.occasions);
  if (occ > 0) {
    score += 3 * occ;
    reasons.push(`fits ${criteria.occasion}`);
  }
  const sty = overlap(criteria.style, [...item.styles, item.formality]);
  if (sty > 0) {
    score += 2 * sty;
    reasons.push(`${criteria.style} style`);
  }
  if (criteria.season) {
    if (overlap(criteria.season, item.seasons) > 0) {
      score += 2;
      reasons.push(`for ${criteria.season}`);
    } else if (item.seasons.length === 0) score += 0.5;
  }
  const role = roleForCategory(item.category);
  for (const anchor of anchors) {
    if (role) {
      const hit = pairingMatches(anchor.pairingSuggestions[PAIRING_KEY_FOR_ROLE[role]] ?? [], item);
      if (hit) {
        score += 3;
        reasons.push(`"${anchor.name}" pairs with ${hit}`);
      }
    }
    const anchorRole = roleForCategory(anchor.category);
    if (anchorRole) {
      const hit = pairingMatches(item.pairingSuggestions[PAIRING_KEY_FOR_ROLE[anchorRole]] ?? [], anchor);
      if (hit) {
        score += 1.5;
        reasons.push(`suggests ${hit}`);
      }
    }
  }
  return { item, score, reasons };
}

export function pickOutfitCandidates(items: ClothingItem[], criteria: PickerCriteria, perRole = 24): PickerResult {
  const requiredIds = new Set(criteria.requiredIds ?? []);
  const anchors = items.filter((i) => requiredIds.has(i.id));
  const groups = Object.fromEntries(OUTFIT_ROLES.map((r) => [r, [] as PickerCandidate[]])) as Record<OutfitRole, PickerCandidate[]>;

  for (const item of items) {
    if (requiredIds.has(item.id)) continue;
    const role = roleForCategory(item.category);
    if (!role) continue;
    groups[role].push(scoreCandidate(item, criteria, anchors));
  }
  for (const role of OUTFIT_ROLES) {
    groups[role] = groups[role]
      .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
      .slice(0, perRole);
  }
  return { anchors, groups };
}
