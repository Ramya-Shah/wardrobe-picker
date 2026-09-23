import type { DuplicateAction } from "@/lib/import/commit";
import type { StagedFile } from "@/lib/images/staging";
import type { ClothingItemInput } from "@/lib/types";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";

/** One row of the import preview — everything the user sees before committing. */
export interface PreviewItem {
  key: string;
  /** Position in the imported JSON (0-based). */
  index: number;
  label: string;
  input: ClothingItemInput | null;
  /** What Claude produced, to work out which fields the user corrected in the preview. */
  originalInput: ClothingItemInput | null;
  inferredFields: string[];
  raw: unknown;
  source: "claude" | "manual";
  /** JSON validation and matching errors. */
  errors: string[];
  warnings: string[];
  imageRef: string | null;
  file: File | null;
  previewUrl: string | null;
  matchNote: string | null;
  staged: StagedFile | null;
  uploadError: string | null;
  duplicateOf: { id: string; name: string } | null;
  /** Earlier item in this same import that has the identical photo. */
  duplicateInBatch: number | null;
  duplicateAction: DuplicateAction | null;
  excluded: boolean;
  edited: boolean;
}

/** All blocking problems for an item (validation, missing/invalid image). */
export function blockingErrors(item: PreviewItem): string[] {
  const out = [...item.errors];
  if (item.input) {
    const check = clothingItemInputSchema.safeParse(item.input);
    if (!check.success) out.push(...formatZodIssues(check.error));
  }
  if (!item.file) {
    if (!item.errors.some((e) => /image/i.test(e))) out.push("No image for this item.");
  } else if (item.uploadError) out.push(item.uploadError);
  return [...new Set(out)];
}

export function isImportable(item: PreviewItem): boolean {
  return !item.excluded && blockingErrors(item).length === 0 && Boolean(item.staged);
}

export function willCreate(item: PreviewItem): boolean {
  if (!isImportable(item)) return false;
  if (item.duplicateOf || item.duplicateInBatch !== null) return item.duplicateAction === "add";
  return true;
}

/** Fields changed in the preview compared to Claude's original output. */
export function previewEditedFields(item: PreviewItem): string[] {
  if (!item.input || item.source !== "claude") return [];
  if (!item.originalInput) return Object.keys(item.input);
  return (Object.keys(item.input) as (keyof ClothingItemInput)[]).filter(
    (k) => JSON.stringify(item.input![k]) !== JSON.stringify(item.originalInput![k]),
  );
}
