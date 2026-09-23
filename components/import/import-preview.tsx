"use client";

import { useState } from "react";
import { AlertTriangle, Ban, CircleAlert, Copy, Loader2, Pencil, Undo2 } from "lucide-react";
import { ClothingForm, emptyClothingInput } from "@/components/clothing/clothing-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import type { DuplicateAction } from "@/lib/import/commit";
import type { ClothingItemInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { blockingErrors, isImportable, willCreate, type PreviewItem } from "./preview-item";

/**
 * Import preview: every item with its photo and key metadata, validation errors,
 * duplicate decisions and per-item editing — nothing is saved until "Import".
 */
export function ImportPreview({
  items,
  unusedFiles,
  onChange,
  onAssign,
  onCommit,
  onCancel,
  committing,
}: {
  items: PreviewItem[];
  unusedFiles: string[];
  onChange: (key: string, patch: Partial<PreviewItem>) => void;
  onAssign: (key: string, filename: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  committing: boolean;
}) {
  const [editing, setEditing] = useState<PreviewItem | null>(null);
  const [draft, setDraft] = useState<ClothingItemInput | null>(null);

  const failing = items.filter((i) => !i.excluded && blockingErrors(i).length > 0);
  const importable = items.filter(isImportable);
  const creates = importable.filter(willCreate).length;
  const replaces = importable.filter((i) => i.duplicateAction === "replace" && i.duplicateOf).length;
  const duplicates = importable.filter((i) => i.duplicateOf || i.duplicateInBatch !== null);
  const skips = duplicates.filter((i) => i.duplicateAction === "skip" || !i.duplicateAction).length;
  const canCommit = failing.length === 0 && creates + replaces > 0;

  return (
    <div className="space-y-4 pb-40">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Ready" value={importable.length} />
        <Stat label="Duplicates" value={duplicates.length} tone={duplicates.length ? "warning" : undefined} />
        <Stat label="Errors" value={failing.length} tone={failing.length ? "destructive" : undefined} />
      </div>

      {failing.length > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <div className="flex-1 space-y-2">
            <p>
              {failing.length} item{failing.length === 1 ? "" : "s"} can’t be imported yet. Fix them (tap Edit), or exclude them to import the rest.
            </p>
            <Button size="sm" variant="outline" className="text-foreground" onClick={() => failing.forEach((i) => onChange(i.key, { excluded: true }))}>
              <Ban /> Exclude {failing.length} failed
            </Button>
          </div>
        </Alert>
      )}

      {duplicates.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">All duplicates:</span>
          {(["skip", "replace", "add"] as DuplicateAction[]).map((a) => (
            <Button key={a} size="sm" variant="outline" onClick={() => duplicates.forEach((d) => onChange(d.key, { duplicateAction: a === "replace" && !d.duplicateOf ? "skip" : a }))}>
              {actionLabel(a)}
            </Button>
          ))}
        </div>
      )}

      {unusedFiles.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle />
          <div>
            <p className="font-medium">
              {unusedFiles.length} photo{unusedFiles.length === 1 ? " is" : "s are"} not referenced by the JSON. Assign {unusedFiles.length === 1 ? "it" : "them"} to an item below, or {unusedFiles.length === 1 ? "it" : "they"} will be ignored:
            </p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{unusedFiles.join(", ")}</p>
          </div>
        </Alert>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <PreviewRow
            key={item.key}
            item={item}
            onChange={(patch) => onChange(item.key, patch)}
            spareFiles={unusedFiles}
            onAssign={(filename) => onAssign(item.key, filename)}
            onEdit={() => {
              setEditing(item);
              setDraft(item.input ?? item.draft ?? { ...emptyClothingInput(), name: item.label.startsWith("Item #") ? "" : item.label });
            }}
          />
        ))}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-2">
          <p className="text-center text-xs text-muted-foreground">
            {creates} new{replaces ? ` · ${replaces} metadata update${replaces === 1 ? "" : "s"}` : ""}
            {skips ? ` · ${skips} skipped` : ""}
            {items.some((i) => i.excluded) ? ` · ${items.filter((i) => i.excluded).length} excluded` : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={committing}>
              Cancel
            </Button>
            <Button className="flex-[2]" onClick={onCommit} disabled={!canCommit || committing}>
              {committing && <Loader2 className="animate-spin" />}
              {creates + replaces > 0 ? `Import ${creates + replaces === items.length ? "all " : ""}${creates + replaces}` : "Nothing to import"}
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent aria-describedby="edit-desc">
          <SheetHeader>
            <SheetTitle>Edit before import</SheetTitle>
            <SheetDescription id="edit-desc">Changes here replace what Claude generated for this item.</SheetDescription>
          </SheetHeader>
          <SheetBody className="pb-6">{draft && <ClothingForm value={draft} onChange={setDraft} />}</SheetBody>
          <SheetFooter>
            <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              className="flex-[2]"
              onClick={() => {
                if (editing && draft) {
                  onChange(editing.key, { input: draft, label: draft.name || editing.label, errors: editing.errors.filter((e) => /image/i.test(e)), edited: true });
                }
                setEditing(null);
              }}
            >
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function actionLabel(a: DuplicateAction) {
  return a === "skip" ? "Skip" : a === "replace" ? "Replace metadata" : "Add anyway";
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" }) {
  return (
    <div className="rounded-2xl border bg-card py-2.5">
      <p className={cn("text-xl font-semibold", tone === "warning" && "text-warning", tone === "destructive" && "text-destructive")}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function PreviewRow({
  item,
  onChange,
  onEdit,
  spareFiles,
  onAssign,
}: {
  item: PreviewItem;
  onChange: (patch: Partial<PreviewItem>) => void;
  onEdit: () => void;
  spareFiles: string[];
  onAssign: (filename: string) => void;
}) {
  const errors = blockingErrors(item);
  const input = item.input;
  const isDup = Boolean(item.duplicateOf) || item.duplicateInBatch !== null;
  return (
    <li className={cn("rounded-2xl border bg-card p-3", errors.length && !item.excluded && "border-destructive/40", item.excluded && "opacity-50")}>
      <div className="flex gap-3">
        <div className="aspect-[3/4] w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
          {item.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={item.previewUrl} alt={item.label} loading="lazy" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center p-2 text-center text-[11px] text-muted-foreground">No image</div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 font-medium leading-snug">
              <span className="text-muted-foreground">#{item.index + 1} </span>
              {input?.name || item.label}
            </p>
            {item.edited && <Badge variant="success">Edited</Badge>}
          </div>
          {input && (
            <>
              <p className="text-xs text-muted-foreground">
                {[categoryLabel(input.category), humanize(input.subcategory)].filter(Boolean).join(" › ")}
              </p>
              {(input.primaryColor || input.secondaryColors.length > 0) && (
                <p className="text-xs">{[input.primaryColor, ...input.secondaryColors].filter(Boolean).map((c) => humanize(c)).join(", ")}</p>
              )}
              {input.styles.length > 0 && <p className="text-xs text-muted-foreground">{input.styles.map(humanize).join(", ")}</p>}
              {input.tags.length > 0 && <p className="line-clamp-1 text-[11px] text-muted-foreground">{input.tags.map((t) => `#${t}`).join(" ")}</p>}
            </>
          )}
          <p className="truncate text-[11px] text-muted-foreground">
            {item.file ? item.file.name : item.imageRef ? `image: ${item.imageRef}` : "no image reference"}
            {item.matchNote ? ` · ${item.matchNote}` : ""}
          </p>
        </div>
      </div>

      {!item.excluded && errors.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-xl bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}
      {!item.excluded && !item.file && spareFiles.length > 0 && (
        <div className="mt-2">
          <NativeSelect aria-label="Assign a photo" value="" onChange={(e) => e.target.value && onAssign(e.target.value)} className="h-10 text-sm">
            <option value="">Assign one of the unmatched photos…</option>
            {spareFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {!item.excluded && errors.length === 0 && item.warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
          {item.warnings.map((w) => (
            <li key={w}>⚠︎ {w}</li>
          ))}
        </ul>
      )}

      {!item.excluded && isDup && errors.length === 0 && (
        <div className="mt-3 rounded-xl bg-warning/10 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Copy className="size-4 text-warning" />
            {item.duplicateOf ? "This clothing image already exists." : `Same photo as item #${(item.duplicateInBatch ?? 0) + 1} in this import.`}
          </p>
          {item.duplicateOf && (
            <a href={`/wardrobe/${item.duplicateOf.id}`} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-muted-foreground underline">
              Existing: {item.duplicateOf.name}
            </a>
          )}
          <div className="mt-2 grid grid-cols-3 gap-1 rounded-full bg-background p-1" role="radiogroup" aria-label="Duplicate handling">
            {(["skip", "replace", "add"] as DuplicateAction[])
              .filter((a) => a !== "replace" || item.duplicateOf)
              .map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={item.duplicateAction === a}
                  onClick={() => onChange({ duplicateAction: a })}
                  className={cn(
                    "h-9 rounded-full px-1 text-xs font-medium",
                    item.duplicateAction === a ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {actionLabel(a)}
                </button>
              ))}
          </div>
          {item.duplicateAction === "replace" && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">Fields you edited manually on the existing item are kept.</p>
          )}
        </div>
      )}

      <div className="mt-2 flex justify-end gap-1">
        {item.excluded ? (
          <Button size="sm" variant="ghost" onClick={() => onChange({ excluded: false })}>
            <Undo2 /> Include
          </Button>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit}>
              <Pencil /> {item.input ? "Edit" : "Fix"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ excluded: true })}>
              <Ban /> Exclude
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
