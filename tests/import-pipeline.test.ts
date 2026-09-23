import { existsSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { imagesDir, thumbsDir } from "@/lib/config";
import { getItem, listAllItems } from "@/lib/db/clothing";
import { commitImport } from "@/lib/import/commit";
import { parseClaudeImport } from "@/lib/import/parse-claude-json";
import { matchImagesToItems } from "@/lib/import/match-images";
import { addStagedFile, createStagingSession, getStagedFile } from "@/lib/images/staging";
import { claudeItem, makeImage, resetWardrobe } from "./helpers";

beforeEach(resetWardrobe);

/** Simulates the browser flow: parse JSON → match by filename → stage → commit. */
async function importBatch(json: unknown, files: Record<string, Buffer>, actions: Record<number, "skip" | "replace" | "add"> = {}) {
  const parsed = parseClaudeImport(JSON.stringify(json));
  const { matches } = matchImagesToItems(parsed.items.map((i) => ({ index: i.index, image: i.image })), Object.keys(files));
  const sessionId = await createStagingSession();
  const items = [];
  for (const m of matches) {
    const p = parsed.items[m.itemIndex];
    const staged = await addStagedFile(sessionId, m.filename!, files[m.filename!], "image/png");
    items.push({ stagedKey: staged.key, input: p.input, inferredFields: p.inferredFields, editedFields: [], raw: p.raw, source: "claude" as const, duplicateAction: actions[m.itemIndex] ?? null });
  }
  return commitImport({ sessionId, items });
}

describe("batch import", () => {
  it("imports items, stores images on disk (not in SQLite) and keeps the raw JSON", async () => {
    const files = { "IMG_001.jpg": await makeImage({ r: 0, g: 0, b: 0 }), "IMG_002.jpg": await makeImage({ r: 255, g: 255, b: 255 }) };
    // Items listed in the opposite order of the files: association must be by name.
    const json = { items: [claudeItem({ image: "IMG_002.jpg", name: "White Tee", category: "TOP" }), claudeItem({ image: "IMG_001.jpg" })] };
    const res = await importBatch(json, files);
    expect(res.ok).toBe(true);
    expect(res.created).toHaveLength(2);

    const white = (await listAllItems()).find((i) => i.name === "White Tee")!;
    expect(white.originalFilename).toBe("IMG_002.jpg");
    expect(white.imagePath).toBe(`${white.id}.png`);
    expect(existsSync(path.join(imagesDir(), white.imagePath!))).toBe(true);
    expect(existsSync(path.join(thumbsDir(), `${white.id}.webp`))).toBe(true);
    expect(white.aiGenerated).toBe(true);
    expect(white.inferredFields).toEqual(["material", "seasons"]);
  });

  it("detects duplicates and requires an explicit decision", async () => {
    const img = await makeImage({ r: 10, g: 10, b: 10 });
    await importBatch({ items: [claudeItem()] }, { "IMG_001.jpg": img });

    const noDecision = await importBatch({ items: [claudeItem({ name: "Again" })] }, { "IMG_001.jpg": img });
    expect(noDecision.ok).toBe(false);
    expect(noDecision.errors[0].message).toMatch(/already exists/);
    expect(await listAllItems()).toHaveLength(1);

    const skip = await importBatch({ items: [claudeItem({ name: "Again" })] }, { "IMG_001.jpg": img }, { 0: "skip" });
    expect(skip.skipped).toHaveLength(1);
    expect(await listAllItems()).toHaveLength(1);

    const add = await importBatch({ items: [claudeItem({ name: "Again" })] }, { "IMG_001.jpg": img }, { 0: "add" });
    expect(add.created).toHaveLength(1);
    expect(await listAllItems()).toHaveLength(2);
  });

  it("replace metadata preserves the user's manual corrections", async () => {
    const img = await makeImage({ r: 20, g: 30, b: 40 });
    const first = await importBatch({ items: [claudeItem({ construction: { material: "linen" } })] }, { "IMG_001.jpg": img });
    const id = first.created[0].id;
    const { updateItemMetadata } = await import("@/lib/db/clothing");
    await updateItemMetadata(id, { material: "cotton" });

    const res = await importBatch(
      { items: [claudeItem({ name: "Renamed Jeans", construction: { material: "wool" } })] },
      { "IMG_001.jpg": img },
      { 0: "replace" },
    );
    expect(res.replaced).toEqual([expect.objectContaining({ id })]);
    const item = await getItem(id);
    expect(item?.name).toBe("Renamed Jeans");
    expect(item?.material).toBe("cotton");
    expect(item?.editedFields).toContain("material");
  });

  it("is all-or-nothing when one item is invalid", async () => {
    const sessionId = await createStagingSession();
    const a = await addStagedFile(sessionId, "a.png", await makeImage({ r: 1, g: 0, b: 0 }));
    const b = await addStagedFile(sessionId, "b.png", await makeImage({ r: 2, g: 0, b: 0 }));
    const res = await commitImport({
      sessionId,
      items: [
        { stagedKey: a.key, input: { name: "Good" }, inferredFields: [], editedFields: [], source: "claude" },
        { stagedKey: b.key, input: { name: "" }, inferredFields: [], editedFields: [], source: "claude" },
      ],
    });
    expect(res.ok).toBe(false);
    expect(res.errors).toEqual([expect.objectContaining({ index: 1 })]);
    expect(await listAllItems()).toHaveLength(0);
  });

  it("flags duplicates within the same batch", async () => {
    const img = await makeImage({ r: 50, g: 50, b: 50 });
    const sessionId = await createStagingSession();
    const a = await addStagedFile(sessionId, "a.png", img);
    const b = await addStagedFile(sessionId, "b.png", img);
    const base = { inferredFields: [], editedFields: [], source: "claude" as const };
    const res = await commitImport({ sessionId, items: [{ ...base, stagedKey: a.key, input: { name: "A" } }, { ...base, stagedKey: b.key, input: { name: "B" } }] });
    expect(res.ok).toBe(false);
    expect(res.errors[0].message).toMatch(/same image/);
  });

  it("rejects non-images at staging time and blocks traversal in keys", async () => {
    const sessionId = await createStagingSession();
    await expect(addStagedFile(sessionId, "x.jpg", Buffer.from("hello"))).rejects.toThrow(/not a valid/);
    expect(await getStagedFile(sessionId, "../../etc")).toBeNull();
    await expect(createStagingSession().then((s) => getStagedFile(`${s}/..`, "abc123"))).rejects.toThrow(/Invalid import session/);
  });
});
