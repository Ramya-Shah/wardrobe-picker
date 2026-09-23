import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/http";
import { findItemsByHashes } from "@/lib/db/clothing";
import { addStagedFile } from "@/lib/images/staging";

/**
 * Upload one image into an import session (multipart: sessionId, file).
 * The server validates type/size/content, hashes it and reports whether the
 * same photo already exists in the wardrobe.
 */
export const POST = route(async (request) => {
  const form = await request.formData().catch(() => null);
  if (!form) throw new HttpError(400, "Expected multipart form data.");
  const sessionId = form.get("sessionId");
  const file = form.get("file");
  if (typeof sessionId !== "string") throw new HttpError(400, "Missing sessionId.");
  if (!(file instanceof File)) throw new HttpError(400, 'Missing image in the "file" field.');

  const staged = await addStagedFile(sessionId, file.name, new Uint8Array(await file.arrayBuffer()), file.type);
  const duplicateOf = (await findItemsByHashes([staged.hash])).get(staged.hash) ?? null;
  return NextResponse.json({ file: staged, duplicateOf }, { status: 201 });
});
