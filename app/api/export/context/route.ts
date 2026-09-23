import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, route } from "@/lib/api/http";
import { getItemsByIds, listAllItems } from "@/lib/db/clothing";
import { buildOutfitPrompt, formatItemsAsJson, formatItemsAsText } from "@/lib/export/claude-context";

const schema = z.object({
  /** Empty or missing = whole wardrobe. */
  ids: z.array(z.string().max(64)).max(5000).optional(),
  format: z.enum(["text", "json"]).default("text"),
  /** "items": plain context. "outfit": full prompt asking Claude for outfit JSON. */
  mode: z.enum(["items", "outfit"]).default("items"),
  request: z
    .object({
      occasion: z.string().max(200).nullish(),
      style: z.string().max(200).nullish(),
      season: z.string().max(200).nullish(),
      requiredIds: z.array(z.string().max(64)).max(20).optional(),
      notes: z.string().max(2000).nullish(),
    })
    .optional(),
});

/** Build the text you paste into Claude Chat. */
export const POST = route(async (request) => {
  const body = await readJson(request, schema);
  const items = body.ids?.length ? await getItemsByIds(body.ids) : await listAllItems();
  // Keep the caller's order (e.g. required items first, then ranked candidates).
  if (body.ids?.length) {
    const order = new Map(body.ids.map((id, i) => [id, i]));
    items.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }
  const text =
    body.mode === "outfit"
      ? buildOutfitPrompt(items, body.request ?? {}, body.format)
      : body.format === "json"
        ? formatItemsAsJson(items)
        : formatItemsAsText(items);
  return NextResponse.json({ text, count: items.length });
});
