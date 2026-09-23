import { NextResponse } from "next/server";
import type { z } from "zod";
import { formatZodIssues } from "@/lib/validation/primitives";
import { NotFoundError, ValidationError } from "@/lib/wardrobe/items";
import { StagingError } from "@/lib/images/staging";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
  }
}

export function jsonError(status: number, message: string, details?: string[]) {
  return NextResponse.json({ error: message, ...(details?.length ? { details } : {}) }, { status });
}

/**
 * Reject cross-site mutations. The app has no login (by design), so this stops another
 * website open on the same phone from POSTing to the wardrobe on the local network.
 */
export function assertSameOrigin(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers / curl
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new HttpError(403, "Cross-origin request rejected.");
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(403, "Cross-origin request rejected.");
  }
}

export async function readJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new HttpError(415, "Expected a JSON request body.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new HttpError(400, "The request body is not valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "Invalid request.", formatZodIssues(parsed.error));
  return parsed.data;
}

type Handler<C> = (request: Request, context: C) => Promise<Response>;

/** Wrap a route handler with origin checks and consistent, non-leaky error responses. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    try {
      assertSameOrigin(request);
      return await handler(request, context);
    } catch (e) {
      if (e instanceof HttpError) return jsonError(e.status, e.message, e.details);
      if (e instanceof NotFoundError) return jsonError(404, e.message);
      if (e instanceof ValidationError || e instanceof StagingError) return jsonError(400, e.message);
      console.error(`[api] ${request.method} ${new URL(request.url).pathname} failed:`, e);
      return jsonError(500, "Something went wrong on the server. Check the terminal running the app for details.");
    }
  };
}
