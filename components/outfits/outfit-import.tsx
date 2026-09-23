"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { apiJson, errorMessage } from "@/lib/client/api";
import { humanize } from "@/lib/constants/categories";
import type { ClothingItemSummary } from "@/lib/types";
import type { OutfitImport } from "@/lib/validation/outfit";
import { OutfitPieces } from "./outfit-pieces";

interface ValidatedOutfit {
  index: number;
  ok: boolean;
  outfit: OutfitImport | null;
  label: string;
  errors: string[];
  warnings: string[];
}

/** Paste Claude's outfit JSON → validate structure + every clothing ID → preview with photos → save. */
export function OutfitImporter() {
  const router = useRouter();
  const toast = useToast();
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState<"validate" | "save" | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [result, setResult] = useState<{ outfits: ValidatedOutfit[]; items: Record<string, ClothingItemSummary> } | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  async function validate() {
    setBusy("validate");
    setFatal(null);
    setResult(null);
    try {
      const res = await apiJson<{ fatal: string | null; outfits: ValidatedOutfit[]; items: Record<string, ClothingItemSummary> }>(
        "/api/outfits/validate",
        "POST",
        { json },
      );
      if (res.fatal) setFatal(res.fatal);
      else {
        setResult(res);
        setChosen(new Set(res.outfits.filter((o) => o.ok).map((o) => o.index)));
      }
    } catch (e) {
      setFatal(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!result) return;
    const selected = result.outfits.filter((o) => o.ok && o.outfit && chosen.has(o.index));
    if (!selected.length) return;
    setBusy("save");
    try {
      const res = await apiJson<{ outfits: { id: string }[] }>("/api/outfits", "POST", {
        source: "claude",
        outfits: selected.map((o) => ({ outfit: o.outfit, raw: o.outfit })),
      });
      toast(`Saved ${res.outfits.length} outfit${res.outfits.length === 1 ? "" : "s"}`);
      router.push(res.outfits.length === 1 ? `/outfits/${res.outfits[0].id}` : "/outfits");
      router.refresh();
    } catch (e) {
      toast(errorMessage(e), "error");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5 pb-10">
      <Textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={8}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        className="font-mono text-[13px]"
        placeholder={'Paste Claude’s outfit JSON, e.g.\n{"name": "Casual Dinner", "items": [{"clothingItemId": "itm_…", "role": "TOP"}, …]}'}
      />
      <Button className="w-full" size="lg" onClick={validate} disabled={!json.trim() || busy !== null}>
        {busy === "validate" && <Loader2 className="animate-spin" />} Validate & preview
      </Button>
      {fatal && (
        <Alert variant="destructive">
          <CircleAlert />
          <span>{fatal}</span>
        </Alert>
      )}

      {result?.outfits.map((o) => (
        <section key={o.index} className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">{o.outfit?.name ?? o.label}</h2>
              {o.outfit && (
                <p className="text-sm text-muted-foreground">
                  {[o.outfit.occasion, o.outfit.season, o.outfit.style].filter(Boolean).map((v) => humanize(v)).join(" · ")}
                </p>
              )}
            </div>
            {o.ok && result.outfits.length > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={chosen.has(o.index)}
                  onChange={(e) =>
                    setChosen((c) => {
                      const n = new Set(c);
                      if (e.target.checked) n.add(o.index);
                      else n.delete(o.index);
                      return n;
                    })
                  }
                />
                Save
              </label>
            )}
          </div>
          {o.errors.length > 0 && (
            <Alert variant="destructive">
              <CircleAlert />
              <div>
                <p className="font-medium">This outfit can’t be imported:</p>
                <ul className="mt-1 space-y-0.5 text-xs">
                  {o.errors.map((e) => (
                    <li key={e}>• {e}</li>
                  ))}
                </ul>
              </div>
            </Alert>
          )}
          {o.warnings.length > 0 && (
            <ul className="space-y-0.5 text-xs text-muted-foreground">
              {o.warnings.map((w) => (
                <li key={w}>⚠︎ {w}</li>
              ))}
            </ul>
          )}
          {o.outfit && (
            <OutfitPieces
              pieces={o.outfit.items.map((i) => ({ role: i.role, clothingItemId: i.clothingItemId, item: result.items[i.clothingItemId] ?? null }))}
            />
          )}
          {o.outfit?.explanation && <p className="text-sm leading-relaxed text-muted-foreground">{o.outfit.explanation}</p>}
        </section>
      ))}

      {result && (
        <Button className="w-full" size="lg" onClick={save} disabled={busy !== null || chosen.size === 0}>
          {busy === "save" && <Loader2 className="animate-spin" />}
          {chosen.size ? `Save ${chosen.size === 1 ? "outfit" : `${chosen.size} outfits`}` : "Nothing valid to save"}
        </Button>
      )}
    </div>
  );
}
