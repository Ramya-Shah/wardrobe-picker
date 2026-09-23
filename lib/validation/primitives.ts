import { z } from "zod";
import { UNKNOWN_VALUES } from "@/lib/constants/vocab";

const MAX_TEXT = 500;
const MAX_LONG_TEXT = 5000;
const MAX_LIST = 50;

function toText(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value !== "string") return value;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return UNKNOWN_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
}

/** Optional short text. "unknown", "" and null all become null. */
export const nullableText = z.preprocess(toText, z.string().max(MAX_TEXT).nullable()).default(null);

/** Like nullableText but lowercased — used for filterable attributes (colors, fit, material…). */
export const nullableAttr = z.preprocess(
  (v) => {
    const t = toText(v);
    return typeof t === "string" ? t.toLowerCase() : t;
  },
  z.string().max(MAX_TEXT).nullable(),
).default(null);

/** Optional long text (descriptions, notes). Whitespace inside is preserved except trimming. */
export const nullableLongText = z
  .preprocess((v) => {
    if (v === undefined || v === null) return null;
    if (typeof v !== "string") return v;
    const t = v.trim();
    return UNKNOWN_VALUES.has(t.toLowerCase()) ? null : t;
  }, z.string().max(MAX_LONG_TEXT).nullable())
  .default(null);

/** snake_case enum-ish value, e.g. formality "Smart Casual" → "smart_casual". */
export const nullableToken = z.preprocess(
  (v) => {
    const t = toText(v);
    if (typeof t !== "string") return t;
    return t.toLowerCase().replace(/[\s-]+/g, "_");
  },
  z.string().max(100).nullable(),
).default(null);

/**
 * A lenient string list: accepts a single string, an array, or null.
 * Values are trimmed, lowercased, de-duplicated; unknown/empty entries are dropped.
 */
export const textList = z
  .preprocess(
    (v) => {
      if (v === undefined || v === null) return [];
      const arr = Array.isArray(v) ? v : [v];
      const out: string[] = [];
      for (const entry of arr) {
        if (typeof entry !== "string" && typeof entry !== "number") return arr; // let zod report it
        const t = String(entry).trim().replace(/\s+/g, " ").toLowerCase();
        if (!t || UNKNOWN_VALUES.has(t)) continue;
        if (!out.includes(t)) out.push(t);
      }
      return out;
    },
    z.array(z.string().max(200)).max(MAX_LIST),
  )
  .default([]);

/** Format zod issues as human readable "path: message" strings. */
export function formatZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String).join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
