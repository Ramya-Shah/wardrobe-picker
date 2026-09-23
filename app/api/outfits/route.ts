import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, readJson, route } from "@/lib/api/http";
import { getItemsByIds } from "@/lib/db/clothing";
import { createOutfit, listOutfits } from "@/lib/db/outfits";
import { validateOutfitReferences } from "@/lib/outfits/parse-outfit";
import { outfitImportSchema } from "@/lib/validation/outfit";

export const dynamic = "force-dynamic";

export const GET = route(async () => NextResponse.json({ outfits: await listOutfits() }));

const createSchema = z.object({
  outfits: z.array(z.object({ outfit: outfitImportSchema, raw: z.unknown().optional() })).min(1).max(50),
  source: z.enum(["claude", "manual"]).default("claude"),
});

/** Save one or more outfits. References are re-validated server-side; any unknown ID rejects the request. */
export const POST = route(async (request) => {
  const body = await readJson(request, createSchema);
  const ids = [...new Set(body.outfits.flatMap((o) => o.outfit.items.map((i) => i.clothingItemId)))];
  const known = new Map((await getItemsByIds(ids)).map((i) => [i.id, i]));
  const problems: string[] = [];
  for (const { outfit } of body.outfits) {
    const { errors } = validateOutfitReferences(outfit, known);
    problems.push(...errors.map((e) => `${outfit.name}: ${e}`));
  }
  if (problems.length) throw new HttpError(422, "The outfit references clothing that is not in your wardrobe.", problems);
  const created = [];
  for (const o of body.outfits) created.push(await createOutfit(o.outfit, { source: body.source, raw: o.raw }));
  return NextResponse.json({ outfits: created }, { status: 201 });
});
