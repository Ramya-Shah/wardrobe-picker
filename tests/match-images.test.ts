import { describe, expect, it } from "vitest";
import { matchImagesToItems } from "@/lib/import/match-images";

const items = (...refs: (string | null)[]) => refs.map((image, index) => ({ index, image }));

describe("image filename matching", () => {
  it("matches by filename, not by upload order", () => {
    const r = matchImagesToItems(items("IMG_002.jpg", "IMG_001.jpg"), ["IMG_001.jpg", "IMG_002.jpg"]);
    expect(r.matches.map((m) => m.filename)).toEqual(["IMG_002.jpg", "IMG_001.jpg"]);
    expect(r.matches.every((m) => m.kind === "exact")).toBe(true);
    expect(r.unusedFiles).toEqual([]);
  });

  it("falls back to case-insensitive and extension-less matching", () => {
    const r = matchImagesToItems(items("img_001.JPG", "IMG_0002.HEIC"), ["IMG_001.jpg", "IMG_0002.jpeg"]);
    expect(r.matches[0]).toMatchObject({ filename: "IMG_001.jpg", kind: "case-insensitive" });
    expect(r.matches[1]).toMatchObject({ filename: "IMG_0002.jpeg", kind: "stem" });
  });

  it("strips directories from references", () => {
    const r = matchImagesToItems(items("photos/IMG_001.jpg"), ["IMG_001.jpg"]);
    expect(r.matches[0].filename).toBe("IMG_001.jpg");
  });

  it("reports missing references, unmatched files and unused images", () => {
    const r = matchImagesToItems(items(null, "IMG_404.jpg", "IMG_001.jpg"), ["IMG_001.jpg", "IMG_999.jpg"]);
    expect(r.matches[0].error).toMatch(/Missing "image"/);
    expect(r.matches[1].error).toMatch(/No uploaded image named "IMG_404.jpg"/);
    expect(r.matches[2].filename).toBe("IMG_001.jpg");
    expect(r.unusedFiles).toEqual(["IMG_999.jpg"]);
  });

  it("never assigns one file to two items", () => {
    const r = matchImagesToItems(items("IMG_001.jpg", "img_001.jpg"), ["IMG_001.jpg"]);
    expect(r.matches[0].filename).toBe("IMG_001.jpg");
    expect(r.matches[1].filename).toBeNull();
    expect(r.matches[1].error).toMatch(/already used/);
  });

  it("refuses ambiguous stem matches", () => {
    const r = matchImagesToItems(items("IMG_001"), ["IMG_001.jpg", "IMG_001.png"]);
    expect(r.matches[0].filename).toBeNull();
    expect(r.matches[0].error).toMatch(/several/);
  });
});
