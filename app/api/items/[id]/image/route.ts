import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/http";
import { replaceItemImage } from "@/lib/wardrobe/items";

type Ctx = { params: Promise<{ id: string }> };

/** Replace an item's photo (multipart field "file"). */
export const POST = route<Ctx>(async (request, { params }) => {
  const { id } = await params;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, 'Upload an image in the "file" field.');
  const result = await replaceItemImage(id, file.name, new Uint8Array(await file.arrayBuffer()), file.type);
  return NextResponse.json(result);
});
