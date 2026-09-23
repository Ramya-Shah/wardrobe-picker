import type { ClothingItemInput } from "@/lib/types";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { formatZodIssues } from "@/lib/validation/primitives";
import type { DuplicateAction } from "~/core/commit";
import type { StagedImage } from "~/core/images";

/** One row of the import preview. */
export interface PreviewItem {
  key: string;
  index: number;
  label: string;
  input: ClothingItemInput | null;
  /** Claude's version (or the salvaged draft), to know which fields the user corrected. */
  originalInput: ClothingItemInput | null;
  draft: ClothingItemInput | null;
  inferredFields: string[];
  raw: unknown;
  errors: string[];
  warnings: string[];
  imageRef: string | null;
  staged: StagedImage | null;
  photoName: string | null;
  photoError: string | null;
  matchNote: string | null;
  duplicateOf: { id: string; name: string } | null;
  duplicateInBatch: number | null;
  duplicateAction: DuplicateAction | null;
  excluded: boolean;
  edited: boolean;
}

export function blockingErrors(item: PreviewItem): string[] {
  const out = [...item.errors];
  if (item.input) {
    const check = clothingItemInputSchema.safeParse(item.input);
    if (!check.success) out.push(...formatZodIssues(check.error));
  }
  if (item.photoError) out.push(item.photoError);
  else if (!item.staged && !item.errors.some((e) => /image|photo/i.test(e))) out.push("No photo for this item.");
  return [...new Set(out)];
}

export const isDuplicate = (i: PreviewItem) => Boolean(i.duplicateOf) || i.duplicateInBatch !== null;
export const isImportable = (i: PreviewItem) => !i.excluded && Boolean(i.staged) && blockingErrors(i).length === 0;
/** Items that will actually be sent to the commit (skipped duplicates are left out). */
export const willSend = (i: PreviewItem) => isImportable(i) && !(isDuplicate(i) && (i.duplicateAction ?? "skip") === "skip");

export function editedFieldsOf(item: PreviewItem): string[] {
  if (!item.input) return [];
  if (!item.originalInput) return Object.keys(item.input);
  return (Object.keys(item.input) as (keyof ClothingItemInput)[]).filter((k) => JSON.stringify(item.input![k]) !== JSON.stringify(item.originalInput![k]));
}
