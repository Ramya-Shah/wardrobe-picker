import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { searchQueryFromParams } from "@/lib/search/filters";
import { searchItems } from "@/lib/search/search";

export const dynamic = "force-dynamic";

/** GET /api/items?q=black shirt&category=TOP&color=black&season=summer&offset=0&limit=48 */
export const GET = route(async (request) => {
  const query = searchQueryFromParams(new URL(request.url).searchParams);
  return NextResponse.json(await searchItems(query));
});
