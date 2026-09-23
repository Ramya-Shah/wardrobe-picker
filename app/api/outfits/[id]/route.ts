import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/http";
import { deleteOutfit, getOutfit } from "@/lib/db/outfits";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_request, { params }) => {
  const outfit = await getOutfit((await params).id);
  if (!outfit) throw new HttpError(404, "Outfit not found.");
  return NextResponse.json({ outfit });
});

/** Deleting an outfit never deletes the clothing in it. */
export const DELETE = route<Ctx>(async (_request, { params }) => {
  if (!(await deleteOutfit((await params).id))) throw new HttpError(404, "Outfit not found.");
  return NextResponse.json({ ok: true });
});
