import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, route } from "@/lib/api/http";
import { getItemsByIds } from "@/lib/db/clothing";
import { toSummary } from "@/lib/db/mappers";
import { parseOutfitImport, validateOutfitReferences } from "@/lib/outfits/parse-outfit";

/** Validate Claude outfit JSON: structure, roles and that every clothing ID exists. */
export const POST = route(async (request) => {
  const { json } = await readJson(request, z.object({ json: z.string().max(500_000) }));
  const parsed = parseOutfitImport(json);
  if (parsed.fatal) return NextResponse.json({ fatal: parsed.fatal, outfits: [], items: {} });

  const ids = parsed.outfits.flatMap((o) => o.outfit?.items.map((i) => i.clothingItemId) ?? []);
  const known = await getItemsByIds([...new Set(ids)]);
  const knownMap = new Map(known.map((i) => [i.id, i]));
  for (const o of parsed.outfits) {
    if (!o.outfit) continue;
    const { errors, warnings } = validateOutfitReferences(o.outfit, knownMap);
    o.errors.push(...errors);
    o.warnings.push(...warnings);
    o.ok = o.errors.length === 0;
  }
  return NextResponse.json({
    fatal: null,
    outfits: parsed.outfits.map((o) => ({ index: o.index, ok: o.ok, outfit: o.outfit, label: o.label, errors: o.errors, warnings: o.warnings })),
    items: Object.fromEntries(known.map((i) => [i.id, toSummary(i)])),
  });
});
