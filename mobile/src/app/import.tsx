import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { matchImagesToItems } from "@/lib/import/match-images";
import { parseClaudeImport } from "@/lib/import/parse-claude-json";
import { commitImport, type CommitResult } from "~/core/commit";
import { createStagingDir, removeStagingDir, stageImage, type StagedImage } from "~/core/images";
import { findItemsByHashes } from "~/core/items";
import { ImportPreview } from "~/components/import-preview";
import { editedFieldsOf, willSend, type PreviewItem } from "~/components/import-model";
import { pickPhotoFiles, pickPhotos, pickTextFile, takePhoto, type PickedFile } from "~/platform/pickers";
import { useWardrobe } from "~/state/wardrobe";
import { Banner, Body, Button, Card, Field, Label, Muted, Segmented, Title } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { radius, useColors } from "~/ui/theme";

type Mode = "single" | "batch";
type Step = "input" | "staging" | "preview" | "committing" | "done";

/**
 * Import from Claude.
 *  Single: one photo + the JSON Claude returned for it.
 *  Batch:  many photos + one JSON — matched by filename, never by order.
 */
export default function ImportScreen() {
  const colors = useColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { svc, refresh } = useWardrobe();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(params.mode === "single" ? "single" : "batch");
  const [step, setStep] = useState<Step>("input");
  const [photos, setPhotos] = useState<PickedFile[]>([]);
  const [json, setJson] = useState("");
  const [jsonSource, setJsonSource] = useState<string | null>(null);
  const [editJson, setEditJson] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [spares, setSpares] = useState<Map<string, { staged: StagedImage | null; error: string | null; duplicateOf: { id: string; name: string } | null }>>(new Map());
  const [fatal, setFatal] = useState<string | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const stagingDir = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (stagingDir.current) void removeStagingDir(svc, stagingDir.current);
    },
    [svc],
  );

  const parsed = useMemo(() => (json.trim() ? parseClaudeImport(json) : null), [json]);
  const summary = useMemo(() => {
    if (!parsed || parsed.fatal) return null;
    const valid = parsed.items.filter((i) => i.ok).length;
    const matched =
      mode === "batch" && photos.length
        ? matchImagesToItems(parsed.items.map((i) => ({ index: i.index, image: i.image })), photos.map((p) => p.name)).matches.filter((m) => m.filename).length
        : null;
    return { valid, invalid: parsed.items.length - valid, matched };
  }, [parsed, photos, mode]);

  const addPhotos = async (fn: () => Promise<PickedFile[]>) => {
    try {
      const picked = await fn();
      if (!picked.length) return;
      setPhotos((prev) => (mode === "single" ? picked.slice(0, 1) : [...prev, ...picked.filter((p) => !prev.some((q) => q.name === p.name))]));
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  };

  const pasteJson = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text.trim()) return toast("The clipboard is empty — copy Claude's reply first.", "error");
    setJson(text);
    setJsonSource("Pasted from clipboard");
  };

  const loadJsonFile = async () => {
    const f = await pickTextFile();
    if (!f) return;
    try {
      setJson(await svc.files.readText(f.uri));
      setJsonSource(f.name);
    } catch (e) {
      toast(`Couldn't read ${f.name}: ${e instanceof Error ? e.message : String(e)}`, "error");
    }
  };

  async function buildPreview() {
    setFatal(null);
    if (!parsed) return setFatal("Paste or choose Claude's JSON first.");
    if (parsed.fatal) return setFatal(parsed.fatal);
    if (mode === "single") {
      if (photos.length !== 1) return setFatal("Choose the photo of this item.");
      if (parsed.items.length !== 1) return setFatal(`The JSON contains ${parsed.items.length} items. Use Batch for more than one item.`);
    } else if (!photos.length) return setFatal("Choose the photos that go with this JSON.");

    // Associate photos with items: directly in single mode, by filename in batch mode.
    const fileFor = new Map<number, { photo: PickedFile; note: string | null }>();
    const matchErrors = new Map<number, string>();
    let unused: PickedFile[] = [];
    if (mode === "single") fileFor.set(0, { photo: photos[0], note: null });
    else {
      const byName = new Map(photos.map((p) => [p.name, p]));
      const m = matchImagesToItems(parsed.items.map((i) => ({ index: i.index, image: i.image })), photos.map((p) => p.name));
      for (const x of m.matches) {
        if (x.filename) fileFor.set(x.itemIndex, { photo: byName.get(x.filename)!, note: x.kind === "exact" ? null : `matched ${x.kind}` });
        if (x.error) matchErrors.set(x.itemIndex, x.error);
      }
      unused = photos.filter((p) => m.unusedFiles.includes(p.name));
    }

    setStep("staging");
    const toStage = [...[...fileFor.values()].map((v) => v.photo), ...unused];
    setProgress({ done: 0, total: toStage.length });
    if (stagingDir.current) await removeStagingDir(svc, stagingDir.current);
    const dir = await createStagingDir(svc);
    stagingDir.current = dir;
    const staged = new Map<string, { staged: StagedImage | null; error: string | null }>();
    for (const [i, p] of toStage.entries()) {
      try {
        staged.set(p.name, { staged: await stageImage(svc, dir, p), error: null });
      } catch (e) {
        staged.set(p.name, { staged: null, error: e instanceof Error ? e.message : String(e) });
      }
      setProgress({ done: i + 1, total: toStage.length });
    }
    const dupes = await findItemsByHashes(svc.db, [...staged.values()].flatMap((s) => (s.staged ? [s.staged.hash] : [])));

    const firstByHash = new Map<string, number>();
    const preview: PreviewItem[] = parsed.items.map((p) => {
      const match = fileFor.get(p.index);
      const s = match ? staged.get(match.photo.name) : undefined;
      const hash = s?.staged?.hash;
      let duplicateInBatch: number | null = null;
      if (hash) {
        if (firstByHash.has(hash)) duplicateInBatch = firstByHash.get(hash)!;
        else firstByHash.set(hash, p.index);
      }
      const duplicateOf = hash ? dupes.get(hash) ?? null : null;
      return {
        key: String(p.index),
        index: p.index,
        label: p.label,
        input: p.input,
        originalInput: p.input ?? p.draft,
        draft: p.draft,
        inferredFields: p.inferredFields,
        raw: p.raw,
        errors: [...p.errors, ...(matchErrors.has(p.index) ? [matchErrors.get(p.index)!] : [])],
        warnings: p.warnings,
        imageRef: p.image,
        staged: s?.staged ?? null,
        photoName: match?.photo.name ?? null,
        photoError: s?.error ?? null,
        matchNote: match?.note ?? null,
        duplicateOf,
        duplicateInBatch,
        duplicateAction: duplicateOf || duplicateInBatch !== null ? "skip" : null,
        excluded: false,
        edited: false,
      };
    });
    setSpares(new Map(unused.map((u) => [u.name, { ...(staged.get(u.name) ?? { staged: null, error: null }), duplicateOf: null }])));
    setItems(preview);
    setStep("preview");
  }

  async function commit() {
    const send = items.filter(willSend);
    if (!send.length) return;
    setStep("committing");
    const res = await commitImport(
      svc,
      send.map((i) => ({
        staged: i.staged!,
        input: i.input,
        inferredFields: i.inferredFields,
        editedFields: editedFieldsOf(i),
        raw: i.raw,
        source: "claude",
        duplicateAction: i.duplicateAction,
      })),
    );
    if (!res.ok) {
      const byKey = new Map<string, string[]>();
      for (const e of res.errors) {
        const row = send[e.index];
        if (row) byKey.set(row.key, [...(byKey.get(row.key) ?? []), e.message]);
      }
      setItems((prev) => prev.map((it) => (byKey.has(it.key) ? { ...it, errors: [...it.errors, ...byKey.get(it.key)!] } : it)));
      toast(res.errors.find((e) => e.index < 0)?.message ?? "Some items need attention — nothing was imported.", "error");
      setStep("preview");
      return;
    }
    if (stagingDir.current) await removeStagingDir(svc, stagingDir.current);
    stagingDir.current = null;
    await refresh();
    setResult(res);
    setStep("done");
  }

  const reset = (keepInputs: boolean) => {
    setItems([]);
    setSpares(new Map());
    setResult(null);
    setFatal(null);
    setStep("input");
    if (!keepInputs) {
      setPhotos([]);
      setJson("");
      setJsonSource(null);
    }
  };

  if (step === "done" && result) {
    return (
      <Screen title="Import from Claude" back>
        <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center", gap: 16 }}>
          <Title style={{ fontSize: 28, marginTop: 24 }}>Imported</Title>
          <Muted style={{ fontSize: 14 }}>
            {result.created.length} added{result.replaced.length ? ` · ${result.replaced.length} updated` : ""}
            {result.skipped.length ? ` · ${result.skipped.length} skipped` : ""}
          </Muted>
          <View style={{ alignSelf: "stretch", gap: 4 }}>
            {[...result.created, ...result.replaced].slice(0, 12).map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/item/${c.id}`)}>
                <Body style={{ textDecorationLine: "underline" }}>{c.name}</Body>
              </Pressable>
            ))}
          </View>
          <View style={{ alignSelf: "stretch", gap: 10, marginTop: 12 }}>
            <Button title="View wardrobe" size="lg" onPress={() => router.navigate("/")} />
            <Button title="Import more" size="lg" variant="outline" onPress={() => reset(false)} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  if (step === "preview" || step === "committing") {
    const sendCount = items.filter(willSend).length;
    const blocked = items.some((i) => !i.excluded && (i.errors.length > 0 || !i.staged || i.photoError));
    return (
      <Screen title="Preview" subtitle="Nothing is saved until you import" back>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          <ImportPreview
            items={items}
            spares={[...spares.keys()]}
            onChange={(key, patch) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)))}
            onAssign={(key, name) => {
              const s = spares.get(name);
              if (!s) return;
              const batchDup = s.staged ? items.find((i) => i.staged?.hash === s.staged!.hash && i.key !== key) : undefined;
              void (async () => {
                const dup = s.staged ? (await findItemsByHashes(svc.db, [s.staged.hash])).get(s.staged.hash) ?? null : null;
                setItems((prev) =>
                  prev.map((i) =>
                    i.key === key
                      ? {
                          ...i,
                          staged: s.staged,
                          photoName: name,
                          photoError: s.error,
                          matchNote: "assigned by you",
                          duplicateOf: dup,
                          duplicateInBatch: batchDup ? batchDup.index : null,
                          duplicateAction: dup || batchDup ? "skip" : null,
                          errors: i.errors.filter((e) => !/image|photo/i.test(e)),
                        }
                      : i,
                  ),
                );
                setSpares((prev) => {
                  const n = new Map(prev);
                  n.delete(name);
                  return n;
                });
              })();
            }}
          />
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Button title="Back" variant="outline" style={{ flex: 1 }} onPress={() => reset(true)} disabled={step === "committing"} />
          <Button
            title={sendCount ? `Import ${sendCount === items.length ? "all " : ""}${sendCount}` : "Nothing to import"}
            style={{ flex: 2 }}
            loading={step === "committing"}
            disabled={!sendCount || blocked}
            onPress={commit}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen title="Import from Claude" back actions={<Button title="Prompt" icon="chatbox-ellipses-outline" size="sm" variant="ghost" onPress={() => router.push("/prompt")} />}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 20 }} keyboardShouldPersistTaps="handled">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setPhotos([]);
            setFatal(null);
          }}
          options={[
            { value: "single", label: "Single item" },
            { value: "batch", label: "Batch" },
          ]}
        />
        <Muted>
          {mode === "single"
            ? "One photo and the JSON Claude returned for it."
            : "All the photos plus one JSON with an items array. Photos are matched to items by the \"image\" filename."}
        </Muted>

        <View>
          <Label>{mode === "single" ? "1. Photo" : "1. Photos"}</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Gallery" icon="images-outline" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => addPhotos(() => pickPhotos(mode === "batch"))} />
            <Button title="Files" icon="folder-open-outline" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => addPhotos(() => pickPhotoFiles(mode === "batch"))} />
            {mode === "single" && (
              <Button title="Camera" icon="camera-outline" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => addPhotos(async () => { const p = await takePhoto(); return p ? [p] : []; })} />
            )}
          </View>
          {photos.length > 0 && (
            <View style={{ marginTop: 10, gap: 6 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {photos.slice(0, 30).map((p) => (
                  <Image key={p.uri} source={{ uri: p.uri }} style={{ width: 56, height: 74, borderRadius: radius.sm, backgroundColor: colors.muted }} contentFit="cover" />
                ))}
              </ScrollView>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Muted numberOfLines={2} style={{ flex: 1 }}>
                  {photos.length} photo{photos.length === 1 ? "" : "s"}: {photos.map((p) => p.name).join(", ")}
                </Muted>
                <Pressable onPress={() => setPhotos([])}>
                  <Muted style={{ textDecorationLine: "underline" }}>Clear</Muted>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View>
          <Label>2. Claude’s JSON</Label>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Paste" icon="clipboard-outline" size="sm" style={{ flex: 1 }} onPress={pasteJson} />
            <Button title=".json file" icon="document-outline" variant="outline" size="sm" style={{ flex: 1 }} onPress={loadJsonFile} />
            <Button title={editJson ? "Hide" : "Type"} icon="create-outline" variant="outline" size="sm" style={{ flex: 1 }} onPress={() => setEditJson((v) => !v)} />
          </View>
          {editJson && (
            <Field
              multiline
              value={json}
              onChangeText={(t) => {
                setJson(t);
                setJsonSource("Typed");
              }}
              placeholder='{"items": [ … ]}'
              autoCapitalize="none"
              autoCorrect={false}
              style={{ marginTop: 10, minHeight: 160, fontFamily: "monospace", fontSize: 12 }}
            />
          )}
          {json.trim() ? (
            <Card style={{ marginTop: 10, padding: 12, gap: 4 }}>
              <Muted>
                {jsonSource ?? "JSON"} · {Math.max(1, Math.round(json.length / 1000))} KB
              </Muted>
              {parsed?.fatal ? (
                <Text style={{ color: colors.destructive, fontSize: 13 }}>{parsed.fatal}</Text>
              ) : summary ? (
                <Text style={{ color: summary.invalid ? colors.warning : colors.success, fontSize: 13 }}>
                  {summary.valid} valid item{summary.valid === 1 ? "" : "s"}
                  {summary.invalid ? ` · ${summary.invalid} with errors (details in the preview)` : ""}
                  {summary.matched !== null ? ` · ${summary.matched} photo${summary.matched === 1 ? "" : "s"} matched` : ""}
                </Text>
              ) : null}
            </Card>
          ) : null}
        </View>

        {fatal ? <Banner tone="error">{fatal}</Banner> : null}

        <Button
          title={step === "staging" ? `Checking photos ${progress.done}/${progress.total}…` : "Validate & preview"}
          size="lg"
          loading={step === "staging"}
          onPress={buildPreview}
        />

        <Banner tone="info" icon="sparkles-outline">
          <Body style={{ fontSize: 14 }}>
            Send your photos to Claude with the wardrobe prompt (top right). Claude replies with JSON — copy it, then tap Paste. Nothing is saved until you confirm the preview.
          </Body>
        </Banner>
      </ScrollView>
    </Screen>
  );
}
