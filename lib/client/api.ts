/** Small fetch helpers for client components. Errors carry the server's message + details. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details: string[] = [],
    public body: unknown = null,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  const type = res.headers.get("content-type") ?? "";
  const body: unknown = type.includes("application/json") ? await res.json().catch(() => null) : await res.text().catch(() => null);
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; details?: string[]; errors?: { message: string }[] };
    const message = b.error ?? b.errors?.map((e) => e.message).join("\n") ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status, b.details ?? [], body);
  }
  return body as T;
}

export async function apiJson<T>(url: string, method: string, data?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: data === undefined ? undefined : { "content-type": "application/json" },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  } catch {
    throw new ApiError("Cannot reach the wardrobe server. Is it still running on your computer?", 0);
  }
  return handle<T>(res);
}

export async function apiForm<T>(url: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body: form });
  } catch {
    throw new ApiError("Cannot reach the wardrobe server. Is it still running on your computer?", 0);
  }
  return handle<T>(res);
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.details.length ? `${e.message} ${e.details.join(" · ")}` : e.message;
  return e instanceof Error ? e.message : String(e);
}
