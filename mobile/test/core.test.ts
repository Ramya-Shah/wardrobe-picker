import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { parseClaudeImport } from "@/lib/import/parse-claude-json";
import { matchImagesToItems } from "@/lib/import/match-images";
import { structuredSearch } from "@/lib/search/structured-search";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { createBackupZip, restoreBackup, storageStats, wipeWardrobe, exportCsv, exportWardrobeJson } from "~/core/backup";
import { commitImport, type CommitItem } from "~/core/commit";
import { createStagingDir, imageFile, stageImage, thumbFile } from "~/core/images";
import { createItem, deleteItem, getItem, listItems, updateItemMetadata } from "~/core/items";
import { createOutfit, deleteOutfit, listOutfits } from "~/core/outfits";
import type { Services } from "~/core/services";
import { fakePng, makeServices, writeTemp } from "./node-services";

let svc: Services & { root: string };
beforeEach(async () => {
  svc = await makeServices();
});

const claudeJson = {
  schemaVersion: 1,
  items: [
    { image: "IMG_002.jpg", name: "Cream Striped Overshirt", category: "TOP", subcategory: "overshirt", colors: { primary: "cream", secondary: ["brown"] }, construction: { material: "likely cotton" }, style: ["casual"], seasons: ["summer"], tags: ["striped"], inferredFields: ["construction.material"] },
    { image: "img_001.JPG", name: "Black Jeans", category: "bottoms", subcategory: "jeans", colors: "black", style: ["casual", "minimal"], pairingSuggestions: { shoes: ["white sneakers"] } },
  ],
};

/** The phone's import flow: parse → match by filename → stage → commit. */
async function importFlow(json: unknown, files: Record<string, Uint8Array>, actions: Record<number, "skip" | "replace" | "add"> = {}) {
  const parsed = parseClaudeImport(JSON.stringify(json));
  const { matches } = matchImagesToItems(parsed.items.map((i) => ({ index: i.index, image: i.image })), Object.keys(files));
  const dir = await createStagingDir(svc);
  const items: CommitItem[] = [];
  for (const m of matches) {
    const p = parsed.items[m.itemIndex];
    const staged = await stageImage(svc, dir, { uri: writeTemp(svc, m.filename!, files[m.filename!]), name: m.filename! });
    items.push({ staged, input: p.input, inferredFields: p.inferredFields, editedFields: [], raw: p.raw, source: "claude", duplicateAction: actions[m.itemIndex] ?? null });
  }
  return commitImport(svc, items);
}

describe("phone import pipeline", () => {
  it("imports by filename, stores photos + thumbnails, keeps raw JSON", async () => {
    const res = await importFlow(claudeJson, { "IMG_001.jpg": fakePng(1), "IMG_002.jpg": fakePng(2) });
    expect(res.ok).toBe(true);
    const items = await listItems(svc.db);
    const jeans = items.find((i) => i.name === "Black Jeans")!;
    expect(jeans).toMatchObject({ category: "BOTTOM", primaryColor: "black", originalFilename: "IMG_001.jpg", aiGenerated: true });
    expect(fs.existsSync(imageFile(svc, jeans.imagePath!)!)).toBe(true);
    expect(fs.existsSync(thumbFile(svc, jeans.imagePath!)!)).toBe(true);
    const shirt = items.find((i) => i.name.includes("Overshirt"))!;
    expect(shirt.inferredFields).toEqual(["material"]);
  });

  it("requires a decision for duplicates and preserves manual edits on replace", async () => {
    const files = { "IMG_001.jpg": fakePng(1), "IMG_002.jpg": fakePng(2) };
    await importFlow(claudeJson, files);
    const noDecision = await importFlow(claudeJson, files);
    expect(noDecision.ok).toBe(false);
    expect(noDecision.errors[0].message).toMatch(/already exists/);

    const jeans = (await listItems(svc.db)).find((i) => i.name === "Black Jeans")!;
    await updateItemMetadata(svc.db, jeans.id, { material: "denim" });
    const replaced = await importFlow(
      { items: [{ ...claudeJson.items[1], name: "Black Jeans v2", construction: { material: "wool" } }] },
      { "IMG_001.jpg": fakePng(1) },
      { 0: "replace" },
    );
    expect(replaced.replaced).toHaveLength(1);
    const after = await getItem(svc.db, jeans.id);
    expect(after).toMatchObject({ name: "Black Jeans v2", material: "denim", editedFields: ["material"] });
    expect(await listItems(svc.db)).toHaveLength(2);
  });

  it("is all-or-nothing and leaves no photo behind on failure", async () => {
    const dir = await createStagingDir(svc);
    const a = await stageImage(svc, dir, { uri: writeTemp(svc, "a.png", fakePng(5)), name: "a.png" });
    const b = await stageImage(svc, dir, { uri: writeTemp(svc, "b.png", fakePng(6)), name: "b.png" });
    const res = await commitImport(svc, [
      { staged: a, input: { name: "Good" }, inferredFields: [], editedFields: [], source: "claude" },
      { staged: b, input: { name: "" }, inferredFields: [], editedFields: [], source: "claude" },
    ]);
    expect(res.ok).toBe(false);
    expect(res.errors[0].index).toBe(1);
    expect(await listItems(svc.db)).toHaveLength(0);
    expect((await storageStats(svc)).images.files).toBe(0);
  });

  it("rejects files that aren't images", async () => {
    const dir = await createStagingDir(svc);
    await expect(stageImage(svc, dir, { uri: writeTemp(svc, "x.jpg", new TextEncoder().encode("hello")), name: "x.jpg" })).rejects.toThrow(/not a valid/);
  });
});

describe("items, search and outfits on the phone", () => {
  it("edits track user changes; search works on loaded items", async () => {
    const a = await createItem(svc, { input: clothingItemInputSchema.parse({ name: "White Sneakers", category: "SHOES", primaryColor: "white", seasons: ["summer"] }), source: "manual", aiGenerated: false });
    await createItem(svc, { input: clothingItemInputSchema.parse({ name: "Black Tee", category: "TOP", subcategory: "tshirt", primaryColor: "black" }), source: "manual", aiGenerated: false });
    const edited = await updateItemMetadata(svc.db, a.id, { material: "leather" });
    expect(edited).toMatchObject({ material: "leather", editedFields: ["material"], userEdited: true });
    const items = await listItems(svc.db);
    expect(structuredSearch(items, "white sneakers", {}).map((r) => r.item.name)).toEqual(["White Sneakers"]);
    expect(structuredSearch(items, "tee", {}).map((r) => r.item.name)).toEqual(["Black Tee"]);
    expect(structuredSearch(items, "", { category: ["TOP"], color: ["black"] })).toHaveLength(1);
  });

  it("stores outfits and drops references when an item is deleted", async () => {
    const top = await createItem(svc, { input: clothingItemInputSchema.parse({ name: "Tee", category: "TOP" }), source: "manual", aiGenerated: false });
    const bottom = await createItem(svc, { input: clothingItemInputSchema.parse({ name: "Jeans", category: "BOTTOM" }), source: "manual", aiGenerated: false });
    const id = await createOutfit(svc, { name: "Casual", description: null, occasion: "casual", season: null, style: null, explanation: null, items: [{ clothingItemId: top.id, role: "TOP" }, { clothingItemId: bottom.id, role: "BOTTOM" }] }, { source: "claude" });
    expect((await listOutfits(svc.db, await listItems(svc.db)))[0].items.map((i) => i.item?.name)).toEqual(["Tee", "Jeans"]);
    await deleteItem(svc, bottom.id);
    expect((await listOutfits(svc.db, await listItems(svc.db)))[0].items).toHaveLength(1);
    await deleteOutfit(svc.db, id);
    expect(await listOutfits(svc.db, [])).toHaveLength(0);
  });
});

describe("backup & restore on the phone", () => {
  it("round-trips items, edits, photos and outfits through a streamed zip", async () => {
    await importFlow(claudeJson, { "IMG_001.jpg": fakePng(1), "IMG_002.jpg": fakePng(2) });
    const items = await listItems(svc.db);
    await updateItemMetadata(svc.db, items[0].id, { userNotes: "Size M" });
    await createOutfit(svc, { name: "Look", description: null, occasion: null, season: null, style: null, explanation: null, items: items.map((i) => ({ clothingItemId: i.id, role: i.category === "TOP" ? "TOP" : "BOTTOM" })) }, { source: "manual" });

    const zip = await createBackupZip(svc, "full");
    expect(fs.statSync(zip).size).toBeGreaterThan(100);
    await wipeWardrobe(svc);
    expect(await listItems(svc.db)).toHaveLength(0);

    const res = await restoreBackup(svc, zip, "replace");
    expect(res).toMatchObject({ ok: true, itemsRestored: 2, outfitsRestored: 1, missingImages: [] });
    const restored = await getItem(svc.db, items[0].id);
    expect(restored).toMatchObject({ userNotes: "Size M", editedFields: ["userNotes"] });
    expect(fs.existsSync(imageFile(svc, restored!.imagePath!)!)).toBe(true);
    expect((await listOutfits(svc.db, await listItems(svc.db)))[0].items).toHaveLength(2);

    const merged = await restoreBackup(svc, zip, "merge");
    expect(merged).toMatchObject({ ok: true, itemsRestored: 0, itemsSkipped: 2, outfitsSkipped: 1 });
  });

  it("restores a backup made by the web app (database.json format)", async () => {
    const webDoc = {
      format: "wardrobe-backup",
      version: 1,
      items: [{ id: "itm_web00001", metadata: { name: "Web Shirt", category: "TOP" }, image: null, source: "claude", aiGenerated: true, inferredFields: [], editedFields: [], createdAt: "2026-01-01T00:00:00.000Z" }],
      outfits: [],
    };
    const file = path.join(svc.root, "database.json");
    fs.writeFileSync(file, JSON.stringify(webDoc));
    const res = await restoreBackup(svc, file, "merge");
    expect(res.ok).toBe(true);
    expect((await getItem(svc.db, "itm_web00001"))?.name).toBe("Web Shirt");
  });

  it("rejects invalid backups without touching the wardrobe", async () => {
    await createItem(svc, { input: clothingItemInputSchema.parse({ name: "Keep" }), source: "manual", aiGenerated: false });
    const file = path.join(svc.root, "bad.json");
    fs.writeFileSync(file, JSON.stringify({ format: "wardrobe-backup", version: 1, items: [{ id: "../evil", metadata: {} }] }));
    const res = await restoreBackup(svc, file, "replace");
    expect(res.ok).toBe(false);
    expect(await listItems(svc.db)).toHaveLength(1);
  });

  it("exports JSON and CSV files", async () => {
    await createItem(svc, { input: clothingItemInputSchema.parse({ name: "Tee", category: "TOP" }), source: "manual", aiGenerated: false });
    expect(JSON.parse(fs.readFileSync(await exportWardrobeJson(svc), "utf8")).items[0].name).toBe("Tee");
    expect(fs.readFileSync(await exportCsv(svc), "utf8")).toContain("Tee");
  });
});

describe("settings & backup reminder", () => {
  it("persists settings and ignores unknown/corrupt values", async () => {
    const { loadSettings, saveSettings, DEFAULT_SETTINGS } = await import("~/core/settings");
    expect(await loadSettings(svc.db)).toEqual(DEFAULT_SETTINGS);
    await saveSettings(svc.db, { theme: "dark", backupReminderDays: 7 });
    await svc.db.run("INSERT INTO Setting (key, value) VALUES ('theme2', 'not json')");
    expect(await loadSettings(svc.db)).toMatchObject({ theme: "dark", backupReminderDays: 7 });
  });

  it("decides when a backup is due", async () => {
    const { isBackupDue, DEFAULT_SETTINGS } = await import("~/core/settings");
    const now = new Date("2026-09-30T12:00:00Z");
    const s = { ...DEFAULT_SETTINGS, backupReminderDays: 14 };
    expect(isBackupDue(s, 0, now)).toBe(false); // nothing to back up
    expect(isBackupDue(s, 5, now)).toBe(true); // never backed up
    expect(isBackupDue({ ...s, lastBackupAt: "2026-09-25T12:00:00Z" }, 5, now)).toBe(false);
    expect(isBackupDue({ ...s, lastBackupAt: "2026-09-10T12:00:00Z" }, 5, now)).toBe(true);
    expect(isBackupDue({ ...s, backupSnoozedUntil: "2026-10-01T00:00:00Z" }, 5, now)).toBe(false);
    expect(isBackupDue({ ...s, backupReminderDays: 0 }, 5, now)).toBe(false);
  });

  it("migrates an existing v1 database to v2 without losing data", async () => {
    await createItem(svc, { input: clothingItemInputSchema.parse({ name: "Keep me" }), source: "manual", aiGenerated: false });
    await svc.db.exec("DROP TABLE Setting; PRAGMA user_version = 1;");
    const { migrate } = await import("~/core/schema");
    await migrate(svc.db);
    expect((await svc.db.first<{ user_version: number }>("PRAGMA user_version"))?.user_version).toBe(2);
    expect((await listItems(svc.db))[0].name).toBe("Keep me");
  });
});
