import { Pencil, Sparkles } from "lucide-react";
import type { ClothingItem, EditableField } from "@/lib/types";
import { cn } from "@/lib/utils";

export type FieldOrigin = "edited" | "inferred" | "ai" | "manual";

/** Where a field's current value came from. */
export function fieldOrigin(item: Pick<ClothingItem, "aiGenerated" | "editedFields" | "inferredFields">, field: EditableField): FieldOrigin {
  if (item.editedFields.includes(field)) return "edited";
  if (item.aiGenerated && item.inferredFields.includes(field)) return "inferred";
  if (item.aiGenerated) return "ai";
  return "manual";
}

export function OriginMark({ origin, className }: { origin: FieldOrigin; className?: string }) {
  if (origin === "edited")
    return (
      <span title="Edited by you" className={cn("inline-flex items-center text-success", className)}>
        <Pencil className="size-3" />
        <span className="sr-only">Edited by you</span>
      </span>
    );
  if (origin === "inferred")
    return (
      <span title="Claude's inference (not directly visible)" className={cn("rounded-full bg-ai/10 px-1.5 text-[10px] font-medium text-ai", className)}>
        inferred
      </span>
    );
  if (origin === "ai")
    return (
      <span title="From Claude" className={cn("inline-flex items-center text-ai/70", className)}>
        <Sparkles className="size-3" />
        <span className="sr-only">From Claude</span>
      </span>
    );
  return null;
}

export function ProvenanceLegend({ item }: { item: ClothingItem }) {
  if (!item.aiGenerated && !item.userEdited) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      {item.aiGenerated && (
        <span className="inline-flex items-center gap-1">
          <OriginMark origin="ai" /> from Claude
        </span>
      )}
      {item.inferredFields.length > 0 && (
        <span className="inline-flex items-center gap-1">
          <OriginMark origin="inferred" /> Claude&apos;s guess
        </span>
      )}
      {item.userEdited && (
        <span className="inline-flex items-center gap-1">
          <OriginMark origin="edited" /> edited by you
        </span>
      )}
    </p>
  );
}
