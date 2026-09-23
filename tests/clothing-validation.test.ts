import { describe, expect, it } from "vitest";
import { extractJsonText, parseClaudeImport, validateClaudeItem } from "@/lib/import/parse-claude-json";
import { clothingItemInputSchema, claudeItemToInput, claudeClothingItemSchema, inputToClaudeItem } from "@/lib/validation/clothing";
import { EXAMPLE_ITEM } from "@/lib/export/claude-prompt";
import { claudeItem } from "./helpers";

describe("Claude clothing JSON validation", () => {
  it("accepts the canonical example from the prompt", () => {
    const r = validateClaudeItem(EXAMPLE_ITEM);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.input?.primaryColor).toBe("cream");
    expect(r.input?.styles).toEqual(["casual", "streetwear"]);
    expect(r.inferredFields).toEqual(expect.arrayContaining(["material", "seasons", "occasions", "styles", "formality"]));
  });

  it("round-trips through the app format and back", () => {
    const parsed = claudeClothingItemSchema.parse(EXAMPLE_ITEM);
    const back = inputToClaudeItem(claudeItemToInput(parsed), { image: parsed.image, inferredFields: parsed.inferredFields });
    expect(claudeClothingItemSchema.parse(back)).toEqual(parsed);
  });

  it("requires a name", () => {
    const r = validateClaudeItem(claudeItem({ name: "  " }));
    expect(r.ok).toBe(false);
    expect(r.errors.join(" ")).toMatch(/name/);
  });

  it("maps unknown values to null and normalizes lists", () => {
    const r = validateClaudeItem(
      claudeItem({
        construction: { material: "unknown", fit: "", sleeveType: "N/A" },
        tags: ["Black", "black", " Denim ", "unknown"],
        seasons: "summer",
        formality: "Smart Casual",
      }),
    );
    expect(r.ok).toBe(true);
    expect(r.input?.material).toBeNull();
    expect(r.input?.fit).toBeNull();
    expect(r.input?.sleeveType).toBeNull();
    expect(r.input?.tags).toEqual(["black", "denim"]);
    expect(r.input?.seasons).toEqual(["summer"]);
    expect(r.input?.formality).toBe("smart_casual");
  });

  it("keeps unknown categories/subcategories (with a warning) instead of failing", () => {
    const r = validateClaudeItem(claudeItem({ category: "Swimwear", subcategory: "Board Shorts" }));
    expect(r.ok).toBe(true);
    expect(r.input?.category).toBe("SWIMWEAR");
    expect(r.input?.subcategory).toBe("board_shorts");
    expect(r.warnings.join(" ")).toMatch(/Unknown category/);
  });

  it("normalizes category aliases", () => {
    expect(validateClaudeItem(claudeItem({ category: "tops", subcategory: "T-Shirt" })).input).toMatchObject({ category: "TOP", subcategory: "tshirt" });
    expect(validateClaudeItem(claudeItem({ category: "footwear" })).input?.category).toBe("SHOES");
  });

  it("accepts colors given as a plain string", () => {
    const r = validateClaudeItem(claudeItem({ colors: "Navy" }));
    expect(r.input?.primaryColor).toBe("navy");
  });

  it("rejects malformed structures with a precise path", () => {
    const r = validateClaudeItem(claudeItem({ tags: { a: 1 } }));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/^tags/);
    expect(validateClaudeItem("nope").errors[0]).toMatch(/JSON object/);
  });

  it("flat input schema validates API/user metadata", () => {
    expect(clothingItemInputSchema.safeParse({ name: "" }).success).toBe(false);
    const ok = clothingItemInputSchema.parse({ name: "Tee", category: "top" });
    expect(ok.category).toBe("TOP");
    expect(ok.pairingSuggestions.shoes).toEqual([]);
  });
});

describe("parseClaudeImport", () => {
  it("accepts {items: [...]}, bare arrays and single objects", () => {
    expect(parseClaudeImport({ schemaVersion: 1, items: [claudeItem()] }).items).toHaveLength(1);
    expect(parseClaudeImport([claudeItem(), claudeItem({ image: "IMG_002.jpg" })]).items).toHaveLength(2);
    expect(parseClaudeImport(claudeItem()).items).toHaveLength(1);
  });

  it("strips markdown code fences Claude sometimes adds", () => {
    const text = "Here you go:\n```json\n" + JSON.stringify({ items: [claudeItem()] }) + "\n```";
    expect(extractJsonText(text).startsWith("{")).toBe(true);
    const r = parseClaudeImport(text);
    expect(r.fatal).toBeNull();
    expect(r.ok).toBe(true);
  });

  it("reports invalid JSON as fatal", () => {
    const r = parseClaudeImport('{"items": [ {"name": "x",} ]');
    expect(r.fatal).toMatch(/Invalid JSON/);
  });

  it("reports empty and wrongly shaped documents", () => {
    expect(parseClaudeImport({ items: [] }).fatal).toMatch(/no items/);
    expect(parseClaudeImport({ items: "x" }).fatal).toMatch(/must be an array/);
    expect(parseClaudeImport({ foo: 1 }).fatal).toMatch(/Expected/);
  });

  it("marks exactly which item failed without dropping the others", () => {
    const r = parseClaudeImport({ items: [claudeItem(), claudeItem({ image: "IMG_002.jpg", name: 42 }), claudeItem({ image: "IMG_003.jpg" })] });
    expect(r.ok).toBe(false);
    expect(r.items.map((i) => i.ok)).toEqual([true, false, true]);
    expect(r.items[1].errors[0]).toMatch(/name/);
  });

  it("flags two items claiming the same image", () => {
    const r = parseClaudeImport({ items: [claudeItem(), claudeItem({ name: "Other" })] });
    expect(r.items[1].ok).toBe(false);
    expect(r.items[1].errors.join()).toMatch(/also used by item #1/);
  });
});
