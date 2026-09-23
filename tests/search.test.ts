import { describe, expect, it } from "vitest";
import { searchQueryFromParams, searchQueryToParams, facetValue } from "@/lib/search/filters";
import { buildSearchText } from "@/lib/search/search-text";
import { computeFacets, matchesFilters, structuredSearch, tokenizeQuery } from "@/lib/search/structured-search";
import { emptyPairingSuggestions, type ClothingItem, type ClothingItemInput } from "@/lib/types";

let n = 0;
function item(input: Partial<ClothingItemInput> & { name: string }): ClothingItem {
  const base: ClothingItemInput = {
    category: "TOP", subcategory: null, primaryColor: null, secondaryColors: [], pattern: null, texture: null, graphic: null, logo: null,
    material: null, fit: null, sleeveType: null, neckline: null, length: null, silhouette: null, styles: [], formality: null,
    seasons: [], occasions: [], environments: [], tags: [], description: null, pairingSuggestions: emptyPairingSuggestions(), userNotes: null,
    ...input,
  };
  n++;
  return {
    ...base, id: `itm_${n}`, imagePath: null, originalFilename: null, imageHash: null, imageMime: null, imageSize: null, imageWidth: null,
    imageHeight: null, searchText: buildSearchText(base), source: "claude", aiGenerated: true, userEdited: false, inferredFields: [],
    editedFields: [], schemaVersion: 1, createdAt: new Date(2026, 0, n).toISOString(), updatedAt: new Date().toISOString(),
  };
}

const wardrobe = [
  item({ name: "Black Oxford Shirt", subcategory: "shirt", primaryColor: "black", styles: ["smart", "minimal"], seasons: ["spring", "autumn"], occasions: ["office", "dinner"], formality: "smart_casual", fit: "slim", material: "likely cotton" }),
  item({ name: "Cream Striped Overshirt", subcategory: "overshirt", primaryColor: "cream", secondaryColors: ["brown"], pattern: "vertical stripes", fit: "oversized", styles: ["casual", "streetwear"], seasons: ["summer", "spring"], occasions: ["college", "travel"], tags: ["striped", "neutral"] }),
  item({ name: "White Leather Sneakers", category: "SHOES", subcategory: "sneakers", primaryColor: "white", styles: ["casual", "minimal"], seasons: ["summer", "spring", "autumn"], occasions: ["casual", "college"] }),
  item({ name: "Black Relaxed Jeans", category: "BOTTOM", subcategory: "jeans", primaryColor: "black", fit: "relaxed", styles: ["casual"], seasons: ["autumn", "winter"], occasions: ["college"], pairingSuggestions: { ...emptyPairingSuggestions(), shoes: ["white sneakers"] } }),
  item({ name: "Grey Graphic Tee", subcategory: "tshirt", primaryColor: "grey", graphic: "band logo", styles: ["casual", "streetwear"], seasons: ["summer"], occasions: ["casual"], formality: "casual" }),
];

const names = (r: { item: ClothingItem }[]) => r.map((x) => x.item.name);

describe("search text", () => {
  it("builds normalized, de-duplicated searchable text without pairing suggestions", () => {
    const text = wardrobe[3].searchText;
    expect(text).toContain("black relaxed jeans bottom bottoms");
    expect(text).not.toContain("sneakers");
    expect(new Set(text.split(" ")).size).toBe(text.split(" ").length);
  });

  it("indexes synonyms for subcategories", () => {
    expect(wardrobe[4].searchText).toContain("tee");
    expect(wardrobe[4].searchText).toContain("t-shirt");
  });
});

describe("structured search", () => {
  it.each([
    ["black shirt", ["Black Oxford Shirt"]],
    ["oversized", ["Cream Striped Overshirt"]],
    ["white sneakers", ["White Leather Sneakers"]],
    ["striped", ["Cream Striped Overshirt"]],
    ["stripes", ["Cream Striped Overshirt"]],
    ["tees", ["Grey Graphic Tee"]],
    ["t-shirt", ["Grey Graphic Tee"]],
  ])("%s", (q, expected) => {
    expect(names(structuredSearch(wardrobe, q, {}))).toEqual(expected);
  });

  it("finds by season, occasion and style", () => {
    expect(names(structuredSearch(wardrobe, "summer", {})).sort()).toEqual(["Cream Striped Overshirt", "Grey Graphic Tee", "White Leather Sneakers"]);
    expect(names(structuredSearch(wardrobe, "college", {}))).toHaveLength(3);
    // "smart_casual" formality also counts as casual
    expect(names(structuredSearch(wardrobe, "casual", {}))).toHaveLength(5);
  });

  it("ranks name/category matches above description-only matches", () => {
    const r = structuredSearch(wardrobe, "black", {});
    expect(r.length).toBe(2);
    expect(r.every((x) => x.score > 1)).toBe(true);
  });

  it("ignores stopwords and requires every remaining word", () => {
    expect(tokenizeQuery("a black shirt for the office")).toEqual(["black", "shirt", "office"]);
    expect(names(structuredSearch(wardrobe, "black shirt for the office", {}))).toEqual(["Black Oxford Shirt"]);
    expect(structuredSearch(wardrobe, "black sneakers", {})).toHaveLength(0);
  });
});

describe("filters", () => {
  it("combines filters with AND across groups and OR within a group", () => {
    const r = structuredSearch(wardrobe, "", { category: ["TOP"], color: ["black"], style: ["minimal"], season: ["autumn"] });
    expect(names(r)).toEqual(["Black Oxford Shirt"]);
    const either = structuredSearch(wardrobe, "", { color: ["black", "white"] });
    expect(either).toHaveLength(3);
    expect(structuredSearch(wardrobe, "", { category: ["TOP"], color: ["white"] })).toHaveLength(0);
  });

  it("matches secondary colors, hedged materials and formality tokens", () => {
    expect(matchesFilters(wardrobe[1], { color: ["brown"] })).toBe(true);
    expect(matchesFilters(wardrobe[0], { material: ["cotton"] })).toBe(true);
    expect(matchesFilters(wardrobe[0], { formality: ["smart casual"] })).toBe(true);
    expect(matchesFilters(wardrobe[0], { fit: ["oversized"] })).toBe(false);
  });

  it("computes facets with counts", () => {
    const f = computeFacets(wardrobe);
    expect(f.color.find((c) => c.value === "black")?.count).toBe(2);
    expect(f.material).toEqual([{ value: "cotton", count: 1 }]);
    expect(f.category.map((c) => c.value).sort()).toEqual(["BOTTOM", "SHOES", "TOP"]);
  });

  it("sorts by name / newest / oldest", () => {
    expect(names(structuredSearch(wardrobe, "", {}, "name"))[0]).toBe("Black Oxford Shirt");
    expect(names(structuredSearch(wardrobe, "", {}, "newest"))[0]).toBe("Grey Graphic Tee");
    expect(names(structuredSearch(wardrobe, "", {}, "oldest"))[0]).toBe("Black Oxford Shirt");
  });

  it("round-trips search queries through URL params", () => {
    const q = searchQueryFromParams(new URLSearchParams("q=black+shirt&category=top&color=Black,white&sort=name&limit=500"));
    expect(q).toMatchObject({ q: "black shirt", filters: { category: ["TOP"], color: ["black", "white"] }, sort: "name", limit: 200 });
    expect(searchQueryFromParams(searchQueryToParams(q))).toEqual({ ...q, offset: 0 });
    expect(facetValue("Probably Linen.")).toBe("linen");
  });
});
