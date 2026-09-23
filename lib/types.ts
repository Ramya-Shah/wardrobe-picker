import type { PairingKey } from "@/lib/constants/vocab";

export type PairingSuggestions = Record<PairingKey, string[]>;

/** All user-editable metadata of a clothing item (the flat, app-internal shape). */
export interface ClothingItemInput {
  name: string;
  category: string;
  subcategory: string | null;
  primaryColor: string | null;
  secondaryColors: string[];
  pattern: string | null;
  texture: string | null;
  graphic: string | null;
  logo: string | null;
  material: string | null;
  fit: string | null;
  sleeveType: string | null;
  neckline: string | null;
  length: string | null;
  silhouette: string | null;
  styles: string[];
  formality: string | null;
  seasons: string[];
  occasions: string[];
  environments: string[];
  tags: string[];
  description: string | null;
  pairingSuggestions: PairingSuggestions;
  userNotes: string | null;
}

export type EditableField = keyof ClothingItemInput;

/** A clothing item as used across the app (serializable: dates are ISO strings). */
export interface ClothingItem extends ClothingItemInput {
  id: string;
  imagePath: string | null;
  originalFilename: string | null;
  imageHash: string | null;
  imageMime: string | null;
  imageSize: number | null;
  imageWidth: number | null;
  imageHeight: number | null;
  searchText: string;
  source: string;
  aiGenerated: boolean;
  userEdited: boolean;
  inferredFields: string[];
  editedFields: string[];
  schemaVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight projection used by grids and search results. */
export interface ClothingItemSummary {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  primaryColor: string | null;
  tags: string[];
  imageHash: string | null;
  hasImage: boolean;
}

export interface OutfitItemRef {
  clothingItemId: string;
  role: string;
  position: number;
}

export interface Outfit {
  id: string;
  name: string;
  description: string | null;
  occasion: string | null;
  season: string | null;
  style: string | null;
  explanation: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
  items: (OutfitItemRef & { item: ClothingItemSummary | null })[];
}

export function emptyPairingSuggestions(): PairingSuggestions {
  return { tops: [], bottoms: [], dresses: [], outerwear: [], shoes: [], accessories: [] };
}
