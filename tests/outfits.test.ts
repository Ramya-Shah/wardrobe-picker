import { describe, expect, it } from "vitest";
import { parseOutfitImport, validateOutfitReferences, type KnownItem } from "@/lib/outfits/parse-outfit";
import { pickOutfitCandidates } from "@/lib/outfits/picker";
import { buildSearchText } from "@/lib/search/search-text";
import { emptyPairingSuggestions, type ClothingItem, type ClothingItemInput } from "@/lib/types";

const known = new Map<string, KnownItem>([
  ["itm_top", { id: "itm_top", name: "White Tee", category: "TOP" }],
  ["itm_jeans", { id: "itm_jeans", name: "Black Jeans", category: "BOTTOM" }],
  ["itm_shoes", { id: "itm_shoes", name: "White Sneakers", category: "SHOES" }],
  ["itm_dress", { id: "itm_dress", name: "Midi Dress", category: "DRESS" }],
]);

const outfit = (items: unknown, extra: Record<string, unknown> = {}) => ({ name: "Casual Dinner", occasion: "casual dinner", items, explanation: "…", ...extra });

describe("outfit JSON validation", () => {
  it("accepts a valid outfit and normalizes role aliases", () => {
    const r = parseOutfitImport(JSON.stringify(outfit([{ clothingItemId: "itm_top", role: "top" }, { clothingItemId: "itm_jeans", role: "Bottoms" }, { clothingItemId: "itm_shoes", role: "footwear" }])));
    expect(r.fatal).toBeNull();
    expect(r.outfits[0].ok).toBe(true);
    expect(r.outfits[0].outfit?.items.map((i) => i.role)).toEqual(["TOP", "BOTTOM", "SHOES"]);
    expect(validateOutfitReferences(r.outfits[0].outfit!, known)).toEqual({ errors: [], warnings: [] });
  });

  it("accepts {outfits: [...]} and fenced JSON", () => {
    const text = "```json\n" + JSON.stringify({ outfits: [outfit([{ clothingItemId: "itm_top", role: "TOP" }]), outfit([{ clothingItemId: "itm_dress", role: "DRESS" }])] }) + "\n```";
    expect(parseOutfitImport(text).outfits).toHaveLength(2);
  });

  it("rejects bad structure and invalid roles", () => {
    expect(parseOutfitImport(outfit([])).outfits[0].errors.join()).toMatch(/at least one item/);
    expect(parseOutfitImport(outfit([{ clothingItemId: "itm_top", role: "HAT" }])).outfits[0].errors.join()).toMatch(/role must be one of/);
    expect(parseOutfitImport(outfit([{ role: "TOP" }])).outfits[0].ok).toBe(false);
    expect(parseOutfitImport("{nope").fatal).toMatch(/Invalid JSON/);
  });

  it("rejects references to clothing IDs that don't exist, and duplicates", () => {
    const parsed = parseOutfitImport(outfit([{ clothingItemId: "itm_top", role: "TOP" }, { clothingItemId: "clothing_404", role: "BOTTOM" }, { clothingItemId: "itm_top", role: "TOP" }]));
    const { errors } = validateOutfitReferences(parsed.outfits[0].outfit!, known);
    expect(errors).toEqual([expect.stringMatching(/Unknown clothing ID "clothing_404"/), expect.stringMatching(/more than once/)]);
  });

  it("warns about odd combinations without rejecting", () => {
    const parsed = parseOutfitImport(outfit([{ clothingItemId: "itm_dress", role: "DRESS" }, { clothingItemId: "itm_jeans", role: "BOTTOM" }, { clothingItemId: "itm_shoes", role: "TOP" }]));
    const { errors, warnings } = validateOutfitReferences(parsed.outfits[0].outfit!, known);
    expect(errors).toEqual([]);
    expect(warnings.join(" ")).toMatch(/dress with a top or bottom/);
    expect(warnings.join(" ")).toMatch(/used as top/);
  });
});

describe("outfit picker", () => {
  let n = 0;
  const mk = (o: Partial<ClothingItemInput> & { name: string; category: string }): ClothingItem => {
    const base: ClothingItemInput = {
      subcategory: null, primaryColor: null, secondaryColors: [], pattern: null, texture: null, graphic: null, logo: null, material: null, fit: null,
      sleeveType: null, neckline: null, length: null, silhouette: null, styles: [], formality: null, seasons: [], occasions: [], environments: [],
      tags: [], description: null, pairingSuggestions: emptyPairingSuggestions(), userNotes: null, ...o,
    };
    return { ...base, id: `itm_${++n}`, imagePath: null, originalFilename: null, imageHash: null, imageMime: null, imageSize: null, imageWidth: null, imageHeight: null, searchText: buildSearchText(base), source: "claude", aiGenerated: true, userEdited: false, inferredFields: [], editedFields: [], schemaVersion: 1, createdAt: "", updatedAt: "" };
  };
  const jeans = mk({ name: "Black Jeans", category: "BOTTOM", subcategory: "jeans", primaryColor: "black", pairingSuggestions: { ...emptyPairingSuggestions(), shoes: ["white sneakers"], tops: ["white t-shirt"] } });
  const sneakers = mk({ name: "White Sneakers", category: "SHOES", subcategory: "sneakers", primaryColor: "white", occasions: ["casual", "dinner"] });
  const boots = mk({ name: "Brown Boots", category: "SHOES", subcategory: "boots", primaryColor: "brown", seasons: ["winter"] });
  const tee = mk({ name: "White Tee", category: "TOP", subcategory: "tshirt", primaryColor: "white", styles: ["minimal"], occasions: ["casual"] });

  it("ranks candidates using occasion, style and the required item's pairing suggestions", () => {
    const r = pickOutfitCandidates([jeans, sneakers, boots, tee], { occasion: "casual dinner", style: "minimal", requiredIds: [jeans.id] });
    expect(r.anchors.map((a) => a.name)).toEqual(["Black Jeans"]);
    expect(r.groups.SHOES[0].item.name).toBe("White Sneakers");
    expect(r.groups.SHOES[0].reasons.join(" ")).toMatch(/pairs with white sneakers/);
    expect(r.groups.TOP[0].item.name).toBe("White Tee");
    expect(r.groups.BOTTOM).toHaveLength(0);
  });
});
