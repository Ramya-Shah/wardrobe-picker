import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, readJson, route } from "@/lib/api/http";
import { countOutfitsUsingItem, getItem, updateItemMetadata } from "@/lib/db/clothing";
import { parseClothingPatch } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";
import { deleteItem } from "@/lib/wardrobe/items";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  const { id } = await params;
  const item = await getItem(id);
  if (!item) throw new HttpError(404, "Clothing item not found.");
  return NextResponse.json({ item, outfitCount: await countOutfitsUsingItem(id) });
});

/** Manual edit. Changed fields are tracked as user-edited and protected from future imports. */
export const PATCH = route<Ctx>(async (request, { params }) => {
  const { id } = await params;
  const body = await readJson(request, z.object({ fields: z.record(z.string(), z.unknown()) }));
  const patch = parseClothingPatch(body.fields);
  if (!patch.success) throw new HttpError(400, "Invalid metadata.", formatZodIssues(patch.error));
  const item = await updateItemMetadata(id, patch.data);
  if (!item) throw new HttpError(404, "Clothing item not found.");
  return NextResponse.json({ item });
});

/** DELETE /api/items/:id?keepImage=1 */
export const DELETE = route<Ctx>(async (request, { params }) => {
  const { id } = await params;
  const keepImage = new URL(request.url).searchParams.get("keepImage") === "1";
  await deleteItem(id, { keepImage });
  return NextResponse.json({ ok: true });
});
