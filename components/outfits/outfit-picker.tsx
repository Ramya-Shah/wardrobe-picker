"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Save, Sparkles, X } from "lucide-react";
import { ClothingCard } from "@/components/clothing/clothing-card";
import { CopyBlock } from "@/components/common/copy-block";
import { WardrobeBrowser } from "@/components/wardrobe/wardrobe-browser";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toaster";
import { apiJson, errorMessage } from "@/lib/client/api";
import { humanize } from "@/lib/constants/categories";
import { COMMON_OCCASIONS, COMMON_STYLES, OUTFIT_ROLE_LABELS, OUTFIT_ROLES, roleForCategory, SEASONS, type OutfitRole } from "@/lib/constants/vocab";
import type { ClothingItemSummary } from "@/lib/types";

export interface PickerCandidateView {
  item: ClothingItemSummary;
  score: number;
  reasons: string[];
}

export interface PickerCriteriaView {
  occasion: string;
  style: string;
  season: string;
  requiredIds: string[];
}

const CONTEXT_PER_ROLE = 8;

/**
 * Outfit Picker: choose occasion/style/season and required items, see ranked candidates
 * per role, then either copy a ready-made prompt for Claude or save your own pick.
 */
export function OutfitPicker({
  criteria,
  anchors,
  groups,
}: {
  criteria: PickerCriteriaView;
  anchors: ClothingItemSummary[];
  groups: Record<OutfitRole, PickerCandidateView[]>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState(criteria);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chooser, setChooser] = useState(false);
  const [chooserSel, setChooserSel] = useState<Set<string>>(new Set(criteria.requiredIds));
  const [context, setContext] = useState<string | null>(null);
  const [contextBusy, setContextBusy] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const navigate = (c: PickerCriteriaView) => {
    const p = new URLSearchParams();
    if (c.occasion) p.set("occasion", c.occasion);
    if (c.style) p.set("style", c.style);
    if (c.season) p.set("season", c.season);
    if (c.requiredIds.length) p.set("item", c.requiredIds.join(","));
    router.replace(`/outfits/picker${p.size ? `?${p}` : ""}`, { scroll: false });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allCandidates = OUTFIT_ROLES.flatMap((r) => groups[r]);
  const hasCandidates = allCandidates.length > 0 || anchors.length > 0;

  async function copyForClaude() {
    setContextBusy(true);
    try {
      // Required items first, then your picks, then the best-ranked candidates per role.
      const ids = [
        ...anchors.map((a) => a.id),
        ...selected,
        ...OUTFIT_ROLES.flatMap((r) => groups[r].slice(0, CONTEXT_PER_ROLE).map((c) => c.item.id)),
      ];
      const res = await apiJson<{ text: string }>("/api/export/context", "POST", {
        ids: [...new Set(ids)],
        mode: "outfit",
        format: "text",
        request: {
          occasion: criteria.occasion || null,
          style: criteria.style || null,
          season: criteria.season || null,
          requiredIds: anchors.map((a) => a.id),
        },
      });
      setContext(res.text);
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setContextBusy(false);
    }
  }

  async function saveOutfit() {
    const pieces = [...anchors, ...allCandidates.map((c) => c.item).filter((i) => selected.has(i.id))];
    setSaving(true);
    try {
      const res = await apiJson<{ outfits: { id: string }[] }>("/api/outfits", "POST", {
        source: "manual",
        outfits: [
          {
            outfit: {
              name: name.trim() || [humanize(criteria.occasion), "outfit"].filter(Boolean).join(" "),
              occasion: criteria.occasion || null,
              style: criteria.style || null,
              season: criteria.season || null,
              items: pieces.map((p) => ({ clothingItemId: p.id, role: roleForCategory(p.category) ?? "ACCESSORY" })),
            },
          },
        ],
      });
      toast("Outfit saved");
      router.push(`/outfits/${res.outfits[0].id}`);
    } catch (e) {
      toast(errorMessage(e), "error");
      setSaving(false);
    }
  }

  const pickedCount = anchors.length + selected.size;

  return (
    <div className="space-y-6 pb-44">
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="occasion">Occasion</Label>
            <Input id="occasion" list="occasions" value={draft.occasion} onChange={(e) => setDraft({ ...draft, occasion: e.target.value })} placeholder="casual dinner" />
            <datalist id="occasions">
              {COMMON_OCCASIONS.map((o) => (
                <option key={o} value={o.replace(/_/g, " ")} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="style">Style</Label>
            <Input id="style" list="styles" value={draft.style} onChange={(e) => setDraft({ ...draft, style: e.target.value })} placeholder="minimal" />
            <datalist id="styles">
              {COMMON_STYLES.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Season</Label>
          <div className="flex flex-wrap gap-2">
            {SEASONS.map((s) => (
              <Chip key={s} active={draft.season === s} onClick={() => setDraft({ ...draft, season: draft.season === s ? "" : s })}>
                {humanize(s)}
              </Chip>
            ))}
          </div>
        </div>
        <Button className="w-full" variant="secondary" onClick={() => navigate({ ...draft, requiredIds: criteria.requiredIds })}>
          Find matching items
        </Button>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Required items</h2>
          <Button size="sm" variant="ghost" onClick={() => { setChooserSel(new Set(criteria.requiredIds)); setChooser(true); }}>
            <Plus /> {anchors.length ? "Change" : "Add"}
          </Button>
        </div>
        {anchors.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-5 text-center text-sm text-muted-foreground">
            Optional — pick an item to build the outfit around (e.g. your black jeans).
          </p>
        ) : (
          <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4">
            {anchors.map((a) => (
              <div key={a.id} className="relative w-32 shrink-0">
                <ClothingCard item={a} />
                <button
                  type="button"
                  aria-label={`Remove ${a.name}`}
                  onClick={() => navigate({ ...criteria, requiredIds: criteria.requiredIds.filter((x) => x !== a.id) })}
                  className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {!hasCandidates && (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Your wardrobe is empty. <Link href="/import" className="underline">Import clothes</Link> to start building outfits.
        </p>
      )}

      {OUTFIT_ROLES.filter((r) => groups[r].length > 0).map((role) => (
        <section key={role}>
          <h2 className="mb-2 text-sm font-semibold">
            {OUTFIT_ROLE_LABELS[role]} <span className="font-normal text-muted-foreground">· tap to pick</span>
          </h2>
          <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {groups[role].map((c) => (
              <div key={c.item.id} className="w-32 shrink-0 snap-start">
                <ClothingCard
                  item={c.item}
                  selectable
                  selected={selected.has(c.item.id)}
                  onSelect={toggle}
                  footer={c.reasons.length > 0 ? <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-success">{c.reasons.slice(0, 2).join(" · ")}</p> : null}
                />
              </div>
            ))}
          </div>
        </section>
      ))}

      {hasCandidates && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Button variant="outline" className="flex-1" disabled={pickedCount < 2} onClick={() => setSaveOpen(true)}>
              <Save /> Save ({pickedCount})
            </Button>
            <Button className="flex-[2]" onClick={copyForClaude} disabled={contextBusy}>
              {contextBusy ? <Loader2 className="animate-spin" /> : <Sparkles />} Copy for Claude
            </Button>
          </div>
        </div>
      )}

      <Sheet open={context !== null} onOpenChange={(o) => !o && setContext(null)}>
        <SheetContent aria-describedby="ctx-desc">
          <SheetHeader>
            <SheetTitle>Ask Claude for an outfit</SheetTitle>
            <SheetDescription id="ctx-desc">
              Paste this into Claude. It lists only real items with their IDs; paste Claude&apos;s JSON reply into Import outfit.
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="pb-4">{context && <CopyBlock text={context} filename="outfit-request.txt" label="Copy for Claude" rows={12} />}</SheetBody>
          <SheetFooter>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/outfits/import">Import Claude’s answer</Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={chooser} onOpenChange={setChooser}>
        <SheetContent aria-describedby="choose-desc" className="h-[92dvh]">
          <SheetHeader>
            <SheetTitle>Required items</SheetTitle>
            <SheetDescription id="choose-desc">Pick the items the outfit must include.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <WardrobeBrowser
              initial={null}
              initialState={{ q: "", filters: {}, sort: "newest" }}
              syncUrl={false}
              selectable
              selectedIds={chooserSel}
              onToggleSelect={(id) =>
                setChooserSel((s) => {
                  const n = new Set(s);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                })
              }
            />
          </SheetBody>
          <SheetFooter>
            <Button
              className="flex-1"
              onClick={() => {
                setChooser(false);
                navigate({ ...draft, requiredIds: [...chooserSel].slice(0, 20) });
              }}
            >
              Use {chooserSel.size} item{chooserSel.size === 1 ? "" : "s"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={saveOpen} onOpenChange={setSaveOpen}>
        <SheetContent aria-describedby="save-desc">
          <SheetHeader>
            <SheetTitle>Save outfit</SheetTitle>
            <SheetDescription id="save-desc">{pickedCount} pieces: required items plus your picks.</SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-3 pb-4">
            <Label htmlFor="outfit-name">Name</Label>
            <Input id="outfit-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={criteria.occasion ? `${humanize(criteria.occasion)} outfit` : "Weekend outfit"} />
          </SheetBody>
          <SheetFooter>
            <Button className="flex-1" onClick={saveOutfit} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />} Save outfit
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
