"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileJson, ImagePlus, Images, Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toaster";
import { ApiError, apiJson, errorMessage } from "@/lib/client/api";
import { createImportSession, stageFiles, type StageOutcome } from "@/lib/client/staging";
import type { CommitResult } from "@/lib/import/commit";
import { matchImagesToItems } from "@/lib/import/match-images";
import { parseClaudeImport, type ParseResult } from "@/lib/import/parse-claude-json";
import { cn } from "@/lib/utils";
import { ImportPreview } from "./import-preview";
import { isImportable, previewEditedFields, type PreviewItem } from "./preview-item";

type Mode = "single" | "batch";
type Step = "input" | "uploading" | "preview" | "done";

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/**
 * Import from Claude.
 *  Single: one photo + pasted JSON for that item.
 *  Batch:  many photos + one JSON (file or pasted); matched by filename, never by order.
 * Flow: validate JSON → upload & hash photos → preview (fix/skip/duplicates) → import.
 */
export function ImportWizard({ initialMode = "batch" }: { initialMode?: Mode }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("input");
  const [jsonText, setJsonText] = useState("");
  const [jsonFileName, setJsonFileName] = useState<string | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [spares, setSpares] = useState<Map<string, { file: File; outcome: StageOutcome | undefined }>>(new Map());
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);

  // Revoke preview object URLs when leaving.
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const parsed: ParseResult | null = useMemo(() => (jsonText.trim() ? parseClaudeImport(jsonText) : null), [jsonText]);

  const matchSummary = useMemo(() => {
    if (!parsed || parsed.fatal || mode === "single") return null;
    const m = matchImagesToItems(
      parsed.items.map((i) => ({ index: i.index, image: i.image })),
      images.map((f) => f.name),
    );
    return { matched: m.matches.filter((x) => x.filename).length, unmatched: m.matches.filter((x) => !x.filename).length, unused: m.unusedFiles.length };
  }, [parsed, images, mode]);

  function reset() {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setStep("input");
    setItems([]);
    setResult(null);
    setFatal(null);
    setSessionId(null);
  }

  async function loadJsonFile(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast("That JSON file is larger than 5 MB.", "error");
      return;
    }
    setJsonFileName(file.name);
    setJsonText(await file.text());
  }

  async function buildPreview() {
    setFatal(null);
    if (!parsed) return setFatal("Paste or choose Claude's JSON first.");
    if (parsed.fatal) return setFatal(parsed.fatal);
    if (mode === "single") {
      if (images.length !== 1) return setFatal("Choose the photo of this item.");
      if (parsed.items.length !== 1) return setFatal(`The JSON contains ${parsed.items.length} items. Use Batch import for more than one item.`);
    } else if (images.length === 0) {
      return setFatal("Choose the clothing photos that go with this JSON.");
    }

    // Associate images with items: by filename in batch mode, directly in single mode.
    let fileFor = new Map<number, { file: File; note: string | null }>();
    let matchErrors = new Map<number, string>();
    let unused: string[] = [];
    if (mode === "single") {
      fileFor.set(0, { file: images[0], note: null });
    } else {
      const byName = new Map(images.map((f) => [f.name, f]));
      const m = matchImagesToItems(parsed.items.map((i) => ({ index: i.index, image: i.image })), images.map((f) => f.name));
      fileFor = new Map(
        m.matches.filter((x) => x.filename).map((x) => [x.itemIndex, { file: byName.get(x.filename!)!, note: x.kind === "exact" ? null : `matched ${x.kind}` }]),
      );
      matchErrors = new Map(m.matches.filter((x) => x.error).map((x) => [x.itemIndex, x.error!]));
      unused = m.unusedFiles;
    }

    // Unreferenced photos are uploaded too, so they can be assigned by hand in the preview.
    const unusedSet = new Set(unused);
    const toUpload = [...[...fileFor.values()].map((v) => v.file), ...images.filter((f) => unusedSet.has(f.name))];
    setStep("uploading");
    setProgress({ done: 0, total: toUpload.length });
    let sid: string;
    let staged: Awaited<ReturnType<typeof stageFiles>>;
    try {
      sid = await createImportSession();
      staged = await stageFiles(sid, toUpload, (done, total) => setProgress({ done, total }));
    } catch (e) {
      setStep("input");
      return setFatal(errorMessage(e));
    }

    const firstByHash = new Map<string, number>();
    const preview: PreviewItem[] = parsed.items.map((p) => {
      const match = fileFor.get(p.index) ?? null;
      const outcome = match ? staged.get(match.file) : undefined;
      let previewUrl: string | null = null;
      if (match) {
        previewUrl = URL.createObjectURL(match.file);
        urls.current.push(previewUrl);
      }
      const hash = outcome?.file?.hash;
      let duplicateInBatch: number | null = null;
      if (hash) {
        if (firstByHash.has(hash)) duplicateInBatch = firstByHash.get(hash)!;
        else firstByHash.set(hash, p.index);
      }
      const isDup = Boolean(outcome?.duplicateOf) || duplicateInBatch !== null;
      return {
        key: `${p.index}`,
        index: p.index,
        label: p.label,
        input: p.input,
        originalInput: p.input ?? p.draft,
        draft: p.draft,
        inferredFields: p.inferredFields,
        raw: p.raw,
        source: "claude",
        errors: [...p.errors, ...(matchErrors.has(p.index) ? [matchErrors.get(p.index)!] : [])],
        warnings: p.warnings,
        imageRef: p.image,
        file: match?.file ?? null,
        previewUrl,
        matchNote: match?.note ?? null,
        staged: outcome?.file ?? null,
        uploadError: outcome?.error ?? null,
        duplicateOf: outcome?.duplicateOf ?? null,
        duplicateInBatch,
        duplicateAction: isDup ? "skip" : null,
        excluded: false,
        edited: false,
      };
    });
    setSessionId(sid);
    setSpares(new Map(images.filter((f) => unusedSet.has(f.name)).map((f) => [f.name, { file: f, outcome: staged.get(f) }])));
    setItems(preview);
    setUnusedFiles(unused);
    setStep("preview");
    window.scrollTo({ top: 0 });
  }

  async function commit() {
    if (!sessionId) return;
    const ready = items.filter(isImportable).filter((i) => !(i.duplicateAction === "skip" && (i.duplicateOf || i.duplicateInBatch !== null)));
    if (ready.length === 0) return;
    setCommitting(true);
    try {
      const res = await apiJson<CommitResult>("/api/import/commit", "POST", {
        sessionId,
        items: ready.map((i) => ({
          stagedKey: i.staged!.key,
          input: i.input,
          inferredFields: i.inferredFields,
          editedFields: previewEditedFields(i),
          raw: i.raw,
          source: i.source,
          duplicateAction: i.duplicateAction,
        })),
      });
      // Map commit indexes back to preview rows for the summary.
      setResult({
        ...res,
        created: res.created.map((c) => ({ ...c, index: ready[c.index]?.index ?? c.index })),
        replaced: res.replaced.map((c) => ({ ...c, index: ready[c.index]?.index ?? c.index })),
      });
      setStep("done");
      router.refresh();
      window.scrollTo({ top: 0 });
    } catch (e) {
      const body = e instanceof ApiError ? (e.body as CommitResult | null) : null;
      if (body?.errors?.length) {
        const byKey = new Map<string, string[]>();
        for (const err of body.errors) {
          const row = ready[err.index];
          if (row) byKey.set(row.key, [...(byKey.get(row.key) ?? []), err.message]);
        }
        if (byKey.size) setItems((prev) => prev.map((it) => (byKey.has(it.key) ? { ...it, errors: [...it.errors, ...byKey.get(it.key)!] } : it)));
        toast(body.errors.some((x) => x.index < 0) ? body.errors[0].message : "Some items need attention — nothing was imported.", "error");
      } else toast(errorMessage(e), "error");
    } finally {
      setCommitting(false);
    }
  }

  if (step === "done" && result) {
    return (
      <div className="space-y-6 py-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-success" />
        <div>
          <h2 className="font-serif text-2xl">Imported</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {result.created.length} added
            {result.replaced.length ? ` · ${result.replaced.length} updated` : ""}
            {result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}
          </p>
        </div>
        <ul className="mx-auto max-w-sm space-y-1 text-left text-sm">
          {[...result.created, ...result.replaced].slice(0, 12).map((c) => (
            <li key={c.id}>
              <Link href={`/wardrobe/${c.id}`} className="underline underline-offset-2">
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mx-auto flex max-w-xs flex-col gap-2">
          <Button asChild size="lg">
            <Link href="/">View wardrobe</Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              reset();
              setJsonText("");
              setJsonFileName(null);
              setImages([]);
            }}
          >
            Import more
          </Button>
        </div>
      </div>
    );
  }

  if (step === "preview") {
    return (
      <ImportPreview
        items={items}
        unusedFiles={unusedFiles}
        committing={committing}
        onChange={(key, patch) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))}
        onAssign={(key, filename) => {
          const spare = spares.get(filename);
          if (!spare) return;
          const url = URL.createObjectURL(spare.file);
          urls.current.push(url);
          const hash = spare.outcome?.file?.hash;
          const batchDup = hash ? items.find((i) => i.staged?.hash === hash && i.key !== key) : undefined;
          const isDup = Boolean(spare.outcome?.duplicateOf) || Boolean(batchDup);
          setItems((prev) =>
            prev.map((i) =>
              i.key === key
                ? {
                    ...i,
                    file: spare.file,
                    previewUrl: url,
                    matchNote: "assigned by you",
                    staged: spare.outcome?.file ?? null,
                    uploadError: spare.outcome?.error ?? null,
                    duplicateOf: spare.outcome?.duplicateOf ?? null,
                    duplicateInBatch: batchDup ? batchDup.index : null,
                    duplicateAction: isDup ? "skip" : null,
                    errors: i.errors.filter((e) => !/image|photo/i.test(e)),
                  }
                : i,
            ),
          );
          setUnusedFiles((u) => u.filter((n) => n !== filename));
        }}
        onCommit={commit}
        onCancel={reset}
      />
    );
  }

  const uploading = step === "uploading";
  const validCount = parsed?.items.filter((i) => i.ok).length ?? 0;
  const invalidCount = parsed?.items.filter((i) => !i.ok).length ?? 0;

  return (
    <div className="space-y-5 pb-8">
      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setImages([]); setFatal(null); }}>
        <TabsList>
          <TabsTrigger value="single">
            <ImagePlus /> Single item
          </TabsTrigger>
          <TabsTrigger value="batch">
            <Images /> Batch
          </TabsTrigger>
        </TabsList>
        <TabsContent value="single">
          <p className="text-sm text-muted-foreground">One photo and the JSON Claude returned for it.</p>
        </TabsContent>
        <TabsContent value="batch">
          <p className="text-sm text-muted-foreground">
            All photos plus one JSON with an <code className="rounded bg-muted px-1">items</code> array. Photos are matched to items by the{" "}
            <code className="rounded bg-muted px-1">image</code> filename.
          </p>
        </TabsContent>
      </Tabs>

      <section className="space-y-2">
        <Label>{mode === "single" ? "1. Photo" : "1. Photos"}</Label>
        <input
          ref={imagesRef}
          type="file"
          accept={ACCEPT}
          multiple={mode === "batch"}
          className="hidden"
          onChange={(e) => setImages(Array.from(e.target.files ?? []))}
        />
        <button
          type="button"
          onClick={() => imagesRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-2xl border border-dashed bg-card px-4 py-4 text-left active:bg-accent"
        >
          <ImagePlus className="size-6 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">
              {images.length ? `${images.length} photo${images.length === 1 ? "" : "s"} selected` : mode === "single" ? "Choose or take a photo" : "Choose photos"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {images.length ? images.map((f) => f.name).join(", ") : "JPG, PNG or WebP · up to 25 MB each"}
            </span>
          </span>
        </button>
        {mode === "single" && images[0] && <SinglePreview file={images[0]} />}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="claude-json">2. Claude&apos;s JSON</Label>
          {mode === "batch" && (
            <>
              <input
                ref={jsonFileRef}
                type="file"
                accept="application/json,.json,.txt"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && loadJsonFile(e.target.files[0])}
              />
              <Button size="sm" variant="ghost" onClick={() => jsonFileRef.current?.click()}>
                <FileJson /> {jsonFileName ?? "Choose .json file"}
              </Button>
            </>
          )}
        </div>
        <Textarea
          id="claude-json"
          value={jsonText}
          onChange={(e) => {
            setJsonText(e.target.value);
            setJsonFileName(null);
          }}
          placeholder={mode === "single" ? 'Paste the JSON here, e.g. {"name": "…", "category": "TOP", …}' : 'Paste JSON here or choose the wardrobe.json file — {"items": [ … ]}'}
          rows={mode === "single" ? 8 : 6}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="font-mono text-[13px]"
        />
        {parsed && (
          <div className="text-xs">
            {parsed.fatal ? (
              <p className="text-destructive">{parsed.fatal}</p>
            ) : (
              <p className={cn(invalidCount ? "text-warning" : "text-success")}>
                {validCount} valid item{validCount === 1 ? "" : "s"}
                {invalidCount ? ` · ${invalidCount} with errors (details in the preview)` : ""}
                {matchSummary && images.length > 0 && ` · ${matchSummary.matched} photo${matchSummary.matched === 1 ? "" : "s"} matched`}
                {matchSummary && matchSummary.unmatched > 0 && images.length > 0 && ` · ${matchSummary.unmatched} without photo`}
              </p>
            )}
          </div>
        )}
      </section>

      {fatal && (
        <Alert variant="destructive">
          <span>{fatal}</span>
        </Alert>
      )}

      <Button size="lg" className="w-full" onClick={buildPreview} disabled={uploading}>
        {uploading ? (
          <>
            <Loader2 className="animate-spin" /> Uploading {progress.done}/{progress.total}…
          </>
        ) : (
          "Validate & preview"
        )}
      </Button>
      {uploading && progress.total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
        </div>
      )}

      <div className="rounded-2xl bg-secondary px-4 py-3 text-sm">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles className="size-4" /> Getting the JSON
        </p>
        <p className="mt-1 text-muted-foreground">
          Send your photos to Claude with the prompt in{" "}
          <Link href="/import/prompt" className="underline">
            the wardrobe prompt
          </Link>
          . Claude replies with JSON — paste it here. Nothing is saved until you confirm the preview.
        </p>
      </div>
    </div>
  );
}

function SinglePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="aspect-[3/4] w-32 overflow-hidden rounded-xl bg-muted">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img src={url} alt={file.name} className="size-full object-cover" />
    </div>
  );
}

