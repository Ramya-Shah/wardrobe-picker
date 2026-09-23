import { prisma } from "@/lib/db/client";
import { readItemImage, readThumbnail } from "@/lib/images/storage";
import { SAFE_ID_PATTERN } from "@/lib/db/ids";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/images/:itemId?size=thumb|full&v=<hash>
 * Images are looked up through the database — no filesystem path is ever taken from the URL.
 */
export async function GET(request: Request, { params }: Ctx) {
  const { id } = await params;
  if (!SAFE_ID_PATTERN.test(id)) return new Response("Not found", { status: 404 });
  const row = await prisma.clothingItem.findUnique({ where: { id }, select: { imagePath: true, imageMime: true, imageHash: true } });
  if (!row?.imagePath) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const thumb = url.searchParams.get("size") !== "full";
  const etag = `"${(row.imageHash ?? "x").slice(0, 16)}-${thumb ? "t" : "f"}"`;
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304 });

  const data = thumb ? await readThumbnail(id, row.imagePath) : await readItemImage(row.imagePath);
  if (!data) return new Response("Image file missing", { status: 404 });

  // Versioned URLs (?v=hash) never change content, so they can be cached for a long time.
  const cache = url.searchParams.get("v") ? "private, max-age=31536000, immutable" : "private, max-age=60";
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": thumb ? "image/webp" : (row.imageMime ?? "application/octet-stream"),
      "cache-control": cache,
      etag,
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
