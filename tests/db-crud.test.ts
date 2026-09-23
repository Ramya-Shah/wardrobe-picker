import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { imagesDir } from "@/lib/config";
import { changedFields, createItem, getItem, getRawImport, mergePreservingEdits, updateItemMetadata } from "@/lib/db/clothing";
import { createOutfit, getOutfit, listOutfits } from "@/lib/db/outfits";
import { saveItemImage } from "@/lib/images/storage";
import { searchItems } from "@/lib/search/search";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { deleteItem, duplicateItem, replaceItemImage } from "@/lib/wardrobe/items";
import { makeImage, resetWardrobe } from "./helpers";

beforeEach(resetWardrobe);

const input = (o: Record<string, unknown>) => clothingItemInputSchema.parse(o);

async function withImage(name: string, color: number, extra: Record<string, unknown> = {}) {
  const item = await createItem({ input: input({ name, ...extra }), source: "claude", aiGenerated: true, rawImport: { name } });
  const stored = await saveItemImage(item.id, await makeImage({ r: color, g: 0, b: 0 }), "png");
  const { updateItemImage } = await import("@/lib/db/clothing");
  return updateItemImage(item.id, { imagePath: stored.imagePath, originalFilename: "x.png", imageHash: `h${color}`, imageMime: "image/png", imageSize: 1, imageWidth: stored.width, imageHeight: stored.height });
}

describe("clothing CRUD", () => {
  it("creates and reads items with JSON list fields and searchText", async () => {
    const item = await createItem({ input: input({ name: "Navy Chinos", category: "BOTTOM", subcategory: "chinos", primaryColor: "navy", seasons: ["spring"] }), source: "manual", aiGenerated: false });
    const read = await getItem(item.id);
    expect(read).toMatchObject({ name: "Navy Chinos", seasons: ["spring"], aiGenerated: false, userEdited: false });
    expect(read?.searchText).toContain("navy chinos");
    expect(read?.searchText).toContain("pants");
  });

  it("tracks manually edited fields and preserves them on merge", async () => {
    const item = await createItem({ input: input({ name: "Shirt", material: "linen" }), source: "claude", aiGenerated: true });
    const updated = await updateItemMetadata(item.id, { material: "cotton", name: "Shirt" });
    expect(updated?.editedFields).toEqual(["material"]);
    expect(updated?.userEdited).toBe(true);
    expect(updated?.searchText).toContain("cotton");

    const merged = mergePreservingEdits(updated!, input({ name: "New", material: "silk" }), updated!.editedFields);
    expect(merged.material).toBe("cotton");
    expect(merged.name).toBe("New");
    expect(changedFields(updated!, { name: "Shirt", tags: [] })).toEqual([]);
  });

  it("keeps raw imported JSON for auditing", async () => {
    const item = await createItem({ input: input({ name: "X" }), source: "claude", aiGenerated: true, rawImport: { name: "X", extra: 1 } });
    expect(JSON.parse((await getRawImport(item.id))!)).toEqual({ name: "X", extra: 1 });
  });

  it("deletes the image with the item unless asked to keep it", async () => {
    const a = await withImage("A", 1);
    const b = await withImage("B", 2);
    await deleteItem(a.id);
    expect(existsSync(path.join(imagesDir(), a.imagePath!))).toBe(false);
    await deleteItem(b.id, { keepImage: true });
    expect(existsSync(path.join(imagesDir(), b.imagePath!))).toBe(true);
    expect(await getItem(a.id)).toBeNull();
  });

  it("duplicates items including a copy of the photo", async () => {
    const a = await withImage("A", 3);
    const copy = await duplicateItem(a.id);
    expect(copy.id).not.toBe(a.id);
    expect(copy.name).toBe("A (copy)");
    expect(existsSync(path.join(imagesDir(), copy.imagePath!))).toBe(true);
  });

  it("replaces an image, cleaning up the old extension", async () => {
    const a = await withImage("A", 4);
    const jpeg = await makeImage({ r: 9, g: 9, b: 9 }, "jpeg");
    const res = await replaceItemImage(a.id, "new.jpg", jpeg, "image/jpeg");
    expect(res.item.imagePath).toBe(`${a.id}.jpg`);
    expect(existsSync(path.join(imagesDir(), `${a.id}.png`))).toBe(false);
    await expect(replaceItemImage(a.id, "bad.gif", jpeg)).rejects.toThrow(/Unsupported/);
  });
});

describe("database-backed search", () => {
  it("combines text and filters with pagination", async () => {
    for (let i = 0; i < 7; i++) {
      await createItem({ input: input({ name: `Black Tee ${i}`, subcategory: "tshirt", primaryColor: "black", seasons: i % 2 ? ["summer"] : ["winter"] }), source: "manual", aiGenerated: false });
    }
    await createItem({ input: input({ name: "White Sneakers", category: "SHOES", primaryColor: "white" }), source: "manual", aiGenerated: false });
    const page = await searchItems({ q: "black tee", filters: { season: ["summer"] }, sort: "name", offset: 0, limit: 2 });
    expect(page.total).toBe(3);
    expect(page.items.map((i) => i.name)).toEqual(["Black Tee 1", "Black Tee 3"]);
    const shoes = await searchItems({ q: "", filters: { category: ["SHOES"] }, sort: "newest", offset: 0, limit: 10 });
    expect(shoes.items.map((i) => i.name)).toEqual(["White Sneakers"]);
  });
});

describe("outfits", () => {
  it("stores outfits with roles and cascades when an item is deleted", async () => {
    const top = await withImage("Top", 5, { category: "TOP" });
    const bottom = await withImage("Bottom", 6, { category: "BOTTOM" });
    const outfit = await createOutfit(
      { name: "Dinner", occasion: "dinner", season: null, style: null, description: null, explanation: "Nice", items: [{ clothingItemId: top.id, role: "TOP" }, { clothingItemId: bottom.id, role: "BOTTOM" }] },
      { source: "claude" },
    );
    expect(outfit.items.map((i) => i.role)).toEqual(["TOP", "BOTTOM"]);
    expect((await listOutfits())[0].items[0].item?.name).toBe("Top");
    await deleteItem(bottom.id);
    expect((await getOutfit(outfit.id))?.items).toHaveLength(1);
  });
});
