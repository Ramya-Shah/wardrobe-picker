"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toaster";
import { apiJson, errorMessage } from "@/lib/client/api";
import { createImportSession, stageFiles, type StageOutcome } from "@/lib/client/staging";
import type { CommitResult } from "@/lib/import/commit";
import type { ClothingItemInput } from "@/lib/types";
import { clothingItemInputSchema } from "@/lib/validation/clothing";
import { ClothingForm, emptyClothingInput } from "./clothing-form";

/** Add an item by hand (photo + form). Uses the same staged, duplicate-checked pipeline as imports. */
export function AddClothing() {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [value, setValue] = useState<ClothingItemInput>(emptyClothingInput());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ sessionId: string; outcome: StageOutcome } | null>(null);

  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  async function commit(sessionId: string, outcome: StageOutcome, duplicateAction: "add" | null) {
    const res = await apiJson<CommitResult>("/api/import/commit", "POST", {
      sessionId,
      items: [{ stagedKey: outcome.file!.key, input: value, source: "manual", duplicateAction }],
    });
    const id = res.created[0]?.id;
    toast("Added to your wardrobe");
    router.push(id ? `/wardrobe/${id}` : "/");
    router.refresh();
  }

  async function save() {
    setError(null);
    if (!file) return setError("Add a photo of the item.");
    const check = clothingItemInputSchema.safeParse(value);
    if (!check.success) return setError(check.error.issues[0]?.message ?? "Please check the form.");
    setSaving(true);
    try {
      const sessionId = await createImportSession();
      const outcome = (await stageFiles(sessionId, [file])).get(file)!;
      if (outcome.error || !outcome.file) throw new Error(outcome.error ?? "Upload failed");
      if (outcome.duplicateOf) {
        setPending({ sessionId, outcome });
        setSaving(false);
        return;
      }
      await commit(sessionId, outcome, null);
    } catch (e) {
      setError(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 pb-28">
      <div className="space-y-3">
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex aspect-[3/4] w-full max-w-60 flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-dashed bg-card text-muted-foreground"
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={url} alt="Selected photo" className="size-full object-cover" />
          ) : (
            <>
              <Camera className="size-8" />
              <span className="text-sm">Take or choose a photo</span>
            </>
          )}
        </button>
        <p className="text-sm text-muted-foreground">
          Have Claude describe it instead?{" "}
          <Link href="/import?mode=single" className="inline-flex items-center gap-1 text-foreground underline">
            <Sparkles className="size-3.5" /> Import from Claude
          </Link>
        </p>
      </div>

      <ClothingForm value={value} onChange={setValue} />

      {error && <Alert variant="destructive">{error}</Alert>}

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button variant="outline" className="flex-1" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button className="flex-[2]" onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Add to wardrobe
          </Button>
        </div>
      </div>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This clothing image already exists.</DialogTitle>
            <DialogDescription>
              The same photo is already in your wardrobe as “{pending?.outcome.duplicateOf?.name}”.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => router.push(`/wardrobe/${pending?.outcome.duplicateOf?.id}`)}>
              Skip — view existing
            </Button>
            <Button
              onClick={async () => {
                if (!pending) return;
                setSaving(true);
                try {
                  await commit(pending.sessionId, pending.outcome, "add");
                } catch (e) {
                  setError(errorMessage(e));
                  setSaving(false);
                }
                setPending(null);
              }}
            >
              Add anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
