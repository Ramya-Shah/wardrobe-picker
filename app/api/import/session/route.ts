import { NextResponse } from "next/server";
import { route } from "@/lib/api/http";
import { createStagingSession } from "@/lib/images/staging";

/** Start an import: returns a staging session that images are uploaded into. */
export const POST = route(async () => {
  return NextResponse.json({ sessionId: await createStagingSession() }, { status: 201 });
});
