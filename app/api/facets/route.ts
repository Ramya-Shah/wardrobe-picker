import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { getFacets } from "@/lib/search/search";

export const dynamic = "force-dynamic";

export const GET = route(async () => NextResponse.json({ facets: await getFacets() }));
