import sharp from "sharp";
import { prisma } from "@/lib/db/client";
import { wipeWardrobe } from "@/lib/wardrobe/items";

/** A real, decodable image whose bytes (and hash) depend on the color. */
export async function makeImage(color: { r: number; g: number; b: number }, format: "png" | "jpeg" | "webp" = "png"): Promise<Buffer> {
  return sharp({ create: { width: 40, height: 60, channels: 3, background: color } })[format]().toBuffer();
}

export async function resetWardrobe() {
  await wipeWardrobe();
}

export { prisma };

export function claudeItem(overrides: Record<string, unknown> = {}) {
  return {
    image: "IMG_001.jpg",
    name: "Black Relaxed Fit Jeans",
    category: "BOTTOM",
    subcategory: "jeans",
    colors: { primary: "black", secondary: [] },
    appearance: { pattern: "solid", texture: null, graphic: null, logo: null },
    construction: { material: "denim", fit: "relaxed", sleeveType: null, neckline: null, length: "full length", silhouette: "straight" },
    style: ["casual", "streetwear"],
    formality: "casual",
    seasons: ["autumn", "winter", "spring"],
    occasions: ["college", "casual"],
    environments: ["outdoor"],
    tags: ["black", "denim", "relaxed"],
    description: "Relaxed black jeans.",
    pairingSuggestions: { tops: ["white t-shirt"], bottoms: [], outerwear: [], shoes: ["white sneakers"], accessories: [] },
    inferredFields: ["construction.material", "seasons"],
    ...overrides,
  };
}
