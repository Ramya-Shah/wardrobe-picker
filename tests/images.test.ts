import path from "node:path";
import { describe, expect, it } from "vitest";
import { imagesDir } from "@/lib/config";
import { MAX_IMAGE_BYTES } from "@/lib/constants/limits";
import { resolveImageFile } from "@/lib/images/storage";
import { sha256 } from "@/lib/images/hash";
import { sanitizeFilename, sniffImageType, validateImage } from "@/lib/images/validate";
import { makeImage } from "./helpers";

describe("image validation", () => {
  it("detects real image types from content", async () => {
    expect(sniffImageType(await makeImage({ r: 1, g: 2, b: 3 }, "png"))).toBe("png");
    expect(sniffImageType(await makeImage({ r: 1, g: 2, b: 3 }, "jpeg"))).toBe("jpg");
    expect(sniffImageType(await makeImage({ r: 1, g: 2, b: 3 }, "webp"))).toBe("webp");
    expect(sniffImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });

  it("validates extension, MIME, size and content", async () => {
    const png = await makeImage({ r: 10, g: 20, b: 30 });
    expect(validateImage(png, "shirt.png", "image/png")).toMatchObject({ ok: true, ext: "png", mime: "image/png" });
    expect(validateImage(png, "shirt.gif").error).toMatch(/Unsupported file type/);
    expect(validateImage(png, "shirt.png", "image/svg+xml").error).toMatch(/Unsupported MIME/);
    expect(validateImage(Buffer.from("not an image"), "evil.jpg").error).toMatch(/not a valid/);
    expect(validateImage(Buffer.alloc(0), "empty.jpg").error).toMatch(/empty/);
    expect(validateImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), "big.jpg").error).toMatch(/too large/);
  });

  it("uses the sniffed type even if the extension lies", async () => {
    const jpeg = await makeImage({ r: 1, g: 1, b: 1 }, "jpeg");
    expect(validateImage(jpeg, "photo.png").ext).toBe("jpg");
  });

  it("hashes content deterministically", async () => {
    const a = await makeImage({ r: 5, g: 5, b: 5 });
    expect(sha256(a)).toBe(sha256(Buffer.from(a)));
    expect(sha256(a)).not.toBe(sha256(await makeImage({ r: 6, g: 5, b: 5 })));
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\IMG 1.jpg")).toBe("IMG 1.jpg");
    expect(sanitizeFilename("<img onerror=x>.png")).toBe("_img onerror_x_.png");
    expect(sanitizeFilename("...")).toBe("image");
  });

  it("prevents path traversal when resolving stored images", () => {
    expect(resolveImageFile("itm_abc.jpg")).toBe(path.join(imagesDir(), "itm_abc.jpg"));
    expect(resolveImageFile("../wardrobe.db")).toBeNull();
    expect(resolveImageFile("..%2Fx.jpg")).toBeNull();
    expect(resolveImageFile("/etc/passwd")).toBeNull();
    expect(resolveImageFile("a.svg")).toBeNull();
  });
});
