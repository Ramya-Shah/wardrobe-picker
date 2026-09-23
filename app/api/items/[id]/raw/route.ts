import { HttpError, route } from "@/lib/api/http";
import { getRawImport } from "@/lib/db/clothing";

type Ctx = { params: Promise<{ id: string }> };

/** The original JSON Claude produced for this item (audit/debugging). */
export const GET = route<Ctx>(async (_request, { params }) => {
  const { id } = await params;
  const raw = await getRawImport(id);
  if (raw === null) throw new HttpError(404, "No imported JSON stored for this item.");
  return new Response(raw, { headers: { "content-type": "application/json; charset=utf-8" } });
});
