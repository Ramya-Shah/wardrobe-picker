import { NextResponse } from "next/server";
import { readJson, route } from "@/lib/api/http";
import { commitImport, commitRequestSchema } from "@/lib/import/commit";

/** Save a previewed import. All-or-nothing: on any error nothing is written. */
export const POST = route(async (request) => {
  const body = await readJson(request, commitRequestSchema);
  const result = await commitImport(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
});
