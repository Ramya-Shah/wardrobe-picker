import { readFileSync } from "node:fs";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { buildBackupDocument, createBackupStream, snapshotDatabase } from "@/lib/backup/backup";
import { readBackupArchive, restoreBackup } from "@/lib/backup/restore";
import { createItem, getItem, listAllItems, updateItemImage, updateItemMetadata } from "@/lib/db/clothing";
import { createOutfit, listOutfits } from "@/lib/db/outfits";
import { buildOutfitPrompt, formatItemsAsJson, formatItemsAsText } from "@/lib/export/claude-context";
import { renderPromptMarkdown } from "@/lib/export/claude-prompt";
import { csvCell, itemsToCsv } from "@/lib/export/csv";
import { saveItemImage } from "@/lib/images/storage";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { makeImage, resetWardrobe } from "./helpers";

beforeEach(resetWardrobe);

async function seed() {
  const input = clothingItemInputSchema.parse({
    name: "Cream Striped Overshirt", category: "TOP", subcategory: "overshirt", primaryColor: "cream", secondaryColors: ["brown"],
    pattern: "vertical stripes", styles: ["casual"], seasons: ["summer"], tags: ["striped"], description: "Relaxed, \"boxy\" fit, great layer.",
    pairingSuggestions: { bottoms: ["black jeans"] },
  });
  const item = await createItem({ input, source: "claude", aiGenerated: true, rawImport: { name: "raw" } });
  const stored = await saveItemImage(item.id, await makeImage({ r: 200, g: 190, b: 170 }), "png");
  await updateItemImage(item.id, { imagePath: stored.imagePath, originalFilename: "IMG_1.png", imageHash: "abc", imageMime: "image/png", imageSize: 10, imageWidth: 40, imageHeight: 60 });
  await updateItemMetadata(item.id, { userNotes: "Size M" });
  const jeans = await createItem({ input: clothingItemInputSchema.parse({ name: "Black Jeans", category: "BOTTOM" }), source: "manual", aiGenerated: false });
  await createOutfit({ name: "Weekend", description: null, occasion: "casual", season: null, style: null, explanation: null, items: [{ clothingItemId: item.id, role: "TOP" }, { clothingItemId: jeans.id, role: "BOTTOM" }] }, { source: "manual" });
  return { item, jeans };
}

async function streamToBytes(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe("Claude context export", () => {
  it("formats items as compact text and JSON with their IDs", async () => {
    const { item } = await seed();
    const items = await listAllItems();
    const text = formatItemsAsText(items);
    expect(text).toContain(`CLOTHING ITEM: ${item.id}`);
    expect(text).toContain("Color: Cream, Brown");
    expect(text).toContain("Pattern: Vertical stripes");
    expect(text).toContain("Pairs with: bottoms: black jeans");
    const json = JSON.parse(formatItemsAsJson(items));
    expect(json.wardrobe.find((w: { id: string }) => w.id === item.id)).toMatchObject({ name: "Cream Striped Overshirt", colors: ["cream", "brown"] });
    const prompt = buildOutfitPrompt(items, { occasion: "casual dinner", requiredIds: [item.id] });
    expect(prompt).toContain(`Must include: Cream Striped Overshirt (${item.id})`);
    expect(prompt).toMatch(/Reference items ONLY by their exact clothingItemId/);
  });

  it("exports CSV safely", async () => {
    await seed();
    const csv = itemsToCsv(await listAllItems());
    expect(csv.split("\r\n")[0]).toMatch(/^id,name,category/);
    expect(csv).toContain('"Relaxed, ""boxy"" fit, great layer."');
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
});

describe("backup & restore", () => {
  it("creates a zip with database.json and images", async () => {
    const { item } = await seed();
    const zip = unzipSync(await streamToBytes(createBackupStream("full")));
    const doc = JSON.parse(strFromU8(zip["database.json"]));
    expect(doc).toMatchObject({ format: "wardrobe-backup", version: 1 });
    expect(doc.items).toHaveLength(2);
    expect(doc.outfits).toHaveLength(1);
    expect(zip[`images/${item.id}.png`]).toBeDefined();
    const imagesOnly = unzipSync(await streamToBytes(createBackupStream("images")));
    expect(Object.keys(imagesOnly)).toEqual([`images/${item.id}.png`]);
  });

  it("restores a backup in replace mode, including images, edits and outfits", async () => {
    const { item } = await seed();
    const zipBytes = await streamToBytes(createBackupStream("full"));
    await resetWardrobe();
    expect(await listAllItems()).toHaveLength(0);

    const res = await restoreBackup(zipBytes, "replace");
    expect(res).toMatchObject({ ok: true, itemsRestored: 2, outfitsRestored: 1, missingImages: [] });
    const restored = await getItem(item.id);
    expect(restored).toMatchObject({ name: "Cream Striped Overshirt", userNotes: "Size M", editedFields: ["userNotes"], aiGenerated: true, imagePath: `${item.id}.png` });
    expect((await listOutfits())[0].items).toHaveLength(2);
  });

  it("merge mode skips items that already exist", async () => {
    await seed();
    const zipBytes = await streamToBytes(createBackupStream("full"));
    const res = await restoreBackup(zipBytes, "merge");
    expect(res).toMatchObject({ ok: true, itemsRestored: 0, itemsSkipped: 2, outfitsSkipped: 1 });
    expect(await listAllItems()).toHaveLength(2);
  });

  it("rejects invalid backups without touching the wardrobe", async () => {
    await seed();
    const bad = new TextEncoder().encode(JSON.stringify({ format: "wardrobe-backup", version: 1, items: [{ id: "../evil", metadata: {} }] }));
    const res = await restoreBackup(bad, "replace");
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/invalid id/);
    expect(await listAllItems()).toHaveLength(2);
    expect(readBackupArchive(new TextEncoder().encode("{")).errors[0]).toMatch(/not valid JSON/);
  });

  it("builds a readable backup document and a SQLite snapshot", async () => {
    await seed();
    const doc = await buildBackupDocument();
    expect(doc.items[0].metadata).toHaveProperty("pairingSuggestions");
    const db = await snapshotDatabase();
    expect(db.subarray(0, 15).toString()).toBe("SQLite format 3");
  });
});

describe("Claude prompt document", () => {
  it("docs/CLAUDE_WARDROBE_PROMPT.md is generated from the schema source (run `npm run docs:prompt`)", () => {
    const doc = readFileSync(path.join(process.cwd(), "docs", "CLAUDE_WARDROBE_PROMPT.md"), "utf8");
    expect(doc).toBe(renderPromptMarkdown());
  });
});
