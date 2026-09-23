"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toaster";
import { apiForm, errorMessage } from "@/lib/client/api";
import type { RestoreResult } from "@/lib/backup/restore";
import { cn } from "@/lib/utils";

/** Restore / import a wardrobe from wardrobe-backup.zip (or database.json). */
export function RestoreBackup() {
  const router = useRouter();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function restore() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    form.set("mode", mode);
    form.set("confirm", confirm);
    try {
      const res = await apiForm<RestoreResult>("/api/backup/restore", form);
      setResult(res);
      toast("Backup restored");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input ref={ref} type="file" accept=".zip,application/zip,.json,application/json" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Button variant="outline" className="w-full justify-start" onClick={() => ref.current?.click()}>
        <Upload /> {file ? file.name : "Choose wardrobe-backup.zip"}
      </Button>
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="radiogroup" aria-label="Restore mode">
        {(["merge", "replace"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn("h-9 rounded-full text-sm", mode === m ? "bg-card font-medium shadow-sm" : "text-muted-foreground")}
          >
            {m === "merge" ? "Add to wardrobe" : "Replace everything"}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {mode === "merge"
          ? "Adds items and outfits from the backup that aren't already here (matched by ID). Nothing is deleted."
          : "Deletes your current wardrobe and restores exactly what is in the backup."}
      </p>
      {mode === "replace" && <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type REPLACE to confirm" autoCapitalize="characters" />}
      <Button className="w-full" onClick={restore} disabled={!file || busy || (mode === "replace" && confirm !== "REPLACE")} variant={mode === "replace" ? "destructive" : "default"}>
        {busy && <Loader2 className="animate-spin" />} Restore
      </Button>
      {error && <Alert variant="destructive">{error}</Alert>}
      {result && (
        <Alert variant="success">
          <div>
            <p>
              Restored {result.itemsRestored} items and {result.outfitsRestored} outfits.
              {result.itemsSkipped + result.outfitsSkipped > 0 && ` Skipped ${result.itemsSkipped + result.outfitsSkipped} already present.`}
            </p>
            {result.missingImages.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{result.missingImages.length} photos were missing from the backup: {result.missingImages.slice(0, 5).join(", ")}</p>
            )}
          </div>
        </Alert>
      )}
    </div>
  );
}
