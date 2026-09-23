import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, route } from "@/lib/api/http";
import { wipeWardrobe } from "@/lib/wardrobe/items";

/** Danger zone. Requires {"confirm": "DELETE"}. */
export const POST = route(async (request) => {
  await readJson(request, z.object({ confirm: z.literal("DELETE", { message: 'Type DELETE to confirm.' }) }));
  await wipeWardrobe();
  return NextResponse.json({ ok: true });
});
