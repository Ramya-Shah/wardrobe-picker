"use client";

import { useCallback, useState } from "react";
import { CheckCheck, Loader2, Sparkles, X } from "lucide-react";
import { CopyBlock } from "@/components/common/copy-block";
import { WardrobeBrowser } from "@/components/wardrobe/wardrobe-browser";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toaster";
import { apiJson, errorMessage } from "@/lib/client/api";
import type { SearchResponse } from "@/lib/search/search";
import { cn } from "@/lib/utils";

/** Select wardrobe items (or everything) and copy them as context for Claude, as text or JSON. */
export function ClaudeExport({ initial, categoryCounts }: { initial: SearchResponse; categoryCounts: Record<string, number> }) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState<{ ids: string[]; total: number }>({ ids: initial.items.map((i) => i.id), total: initial.total });
  const [format, setFormat] = useState<"text" | "json">("text");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState<string | null>(null);

  const onResults = useCallback((ids: string[], total: number) => setVisible({ ids, total }), []);

  async function generate(all: boolean) {
    setBusy(true);
    try {
      const res = await apiJson<{ text: string; count: number }>("/api/export/context", "POST", {
        ids: all ? undefined : [...selected],
        format,
        mode: "items",
      });
      setText(res.text);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pb-44">
      <WardrobeBrowser
        initial={initial}
        initialState={{ q: "", filters: {}, sort: "newest" }}
        categoryCounts={categoryCounts}
        syncUrl={false}
        selectable
        selectedIds={selected}
        onResults={onResults}
        stickyTop="top-14"
        onToggleSelect={(id) =>
          setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          })
        }
      />

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-2xl space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex-1 text-muted-foreground">{selected.size} selected</span>
            {selected.size > 0 ? (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X /> Clear
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(visible.ids))} disabled={!visible.ids.length}>
                <CheckCheck /> Select shown ({visible.ids.length})
              </Button>
            )}
            <div className="flex rounded-full bg-secondary p-0.5 text-xs" role="radiogroup" aria-label="Format">
              {(["text", "json"] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={format === f} onClick={() => setFormat(f)} className={cn("h-8 rounded-full px-3", format === f && "bg-card font-medium shadow-sm")}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => generate(true)} disabled={busy}>
              Whole wardrobe
            </Button>
            <Button className="flex-[1.4]" onClick={() => generate(false)} disabled={busy || selected.size === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Copy {selected.size || ""} for Claude
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={text !== null} onOpenChange={(o) => !o && setText(null)}>
        <SheetContent aria-describedby="export-desc">
          <SheetHeader>
            <SheetTitle>Wardrobe context for Claude</SheetTitle>
            <SheetDescription id="export-desc">Paste this into Claude. Claude should refer to items only by their IDs.</SheetDescription>
          </SheetHeader>
          <SheetBody className="pb-6">{text && <CopyBlock text={text} filename={`wardrobe-context.${format === "json" ? "json" : "txt"}`} label="Copy for Claude" rows={14} />}</SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  );
}
