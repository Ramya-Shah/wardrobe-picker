import { NextResponse } from "next/server";
import { HttpError, route } from "@/lib/api/http";
import { restoreBackup } from "@/lib/backup/restore";

/** Restore from wardrobe-backup.zip (or database.json). multipart: file, mode=merge|replace, confirm */
export const POST = route(async (request) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "Choose a backup file (.zip or database.json).");
  const mode = form?.get("mode") === "replace" ? "replace" : "merge";
  if (mode === "replace" && form?.get("confirm") !== "REPLACE") {
    throw new HttpError(400, 'Type REPLACE to confirm replacing your whole wardrobe.');
  }
  const result = await restoreBackup(new Uint8Array(await file.arrayBuffer()), mode);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
});
