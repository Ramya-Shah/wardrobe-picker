import { z } from "zod";
import { OUTFIT_ROLES, type OutfitRole } from "@/lib/constants/vocab";
import { nullableLongText, nullableText } from "./primitives";

const ROLE_ALIASES: Record<string, OutfitRole> = {
  TOP: "TOP",
  TOPS: "TOP",
  SHIRT: "TOP",
  BOTTOM: "BOTTOM",
  BOTTOMS: "BOTTOM",
  PANTS: "BOTTOM",
  DRESS: "DRESS",
  OUTERWEAR: "OUTERWEAR",
  OUTER: "OUTERWEAR",
  JACKET: "OUTERWEAR",
  LAYER: "OUTERWEAR",
  SHOES: "SHOES",
  SHOE: "SHOES",
  FOOTWEAR: "SHOES",
  ACCESSORY: "ACCESSORY",
  ACCESSORIES: "ACCESSORY",
};

export function normalizeRole(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[key] ?? key;
}

export const outfitRoleSchema = z.preprocess(
  normalizeRole,
  z.enum(OUTFIT_ROLES, { message: `role must be one of ${OUTFIT_ROLES.join(", ")}` }),
);

export const outfitItemRefSchema = z.object({
  clothingItemId: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "clothingItemId is required").max(64).regex(/^[A-Za-z0-9_-]+$/, "clothingItemId has invalid characters"),
  ),
  role: outfitRoleSchema,
});

/** An outfit as Claude returns it (see the outfit section of docs/CLAUDE_WARDROBE_PROMPT.md). */
export const outfitImportSchema = z.object({
  name: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.string().min(1, "name is required").max(200)),
  description: nullableLongText,
  occasion: nullableText,
  season: nullableText,
  style: nullableText,
  explanation: nullableLongText,
  items: z.array(outfitItemRefSchema).min(1, "an outfit needs at least one item").max(20),
});

export type OutfitImport = z.infer<typeof outfitImportSchema>;

/** Manual outfit creation / editing from the app. */
export const outfitInputSchema = outfitImportSchema;
