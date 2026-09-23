import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { createBackupZip, exportCsv, exportWardrobeJson, restoreBackup, storageStats, wipeWardrobe, type RestoreMode, type RestoreResult } from "~/core/backup";
import { useWardrobe } from "~/state/wardrobe";
import { Banner, Body, Button, Card, Field, Muted, Segmented, Title, type IconName } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { Sheet } from "~/ui/sheet";
import { useToast } from "~/ui/toast";
import { colors } from "~/ui/theme";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const units = ["KB", "MB", "GB"];
  let v = b / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

export default function SettingsScreen() {
  const { svc, items, outfits, refresh } = useWardrobe();
  const toast = useToast();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof storageStats>> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);

  const loadStats = useCallback(() => {
    storageStats(svc).then(setStats).catch(() => undefined);
  }, [svc]);
  useEffect(loadStats, [loadStats, items.length]);

  async function exportAndShare(key: string, make: () => Promise<string>, mimeType: string) {
    setBusy(key);
    try {
      const path = await make();
      await Sharing.shareAsync(path, { mimeType, dialogTitle: "Save or send" });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen inTabs large title="Settings">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 28 }}>
        <Section title="Storage" description="Everything stays on this phone — no account, no cloud.">
          <Card>
            <StatRow label="Clothing items" value={String(items.length)} />
            <StatRow label="Outfits" value={String(outfits.length)} />
            <StatRow label="Photos" value={stats ? `${stats.images.files} · ${formatBytes(stats.images.bytes)}` : "…"} />
            <StatRow label="Thumbnails" value={stats ? `${stats.thumbs.files} · ${formatBytes(stats.thumbs.bytes)}` : "…"} />
          </Card>
        </Section>

        <Section title="Claude">
          <Card>
            <LinkRow icon="sparkles-outline" label="Import Claude metadata" hint="Photos + JSON" onPress={() => router.push("/import")} />
            <LinkRow icon="chatbox-ellipses-outline" label="Claude wardrobe prompt" hint="Copy the prompt" onPress={() => router.push("/prompt")} />
            <LinkRow icon="shirt-outline" label="Export items for Claude" hint="Copy wardrobe context" onPress={() => router.push("/export")} />
            <LinkRow icon="code-download-outline" label="Import Claude outfit" hint="Paste outfit JSON" onPress={() => router.push("/outfit-import")} />
          </Card>
        </Section>

        <Section title="Export & backup" description="Save to Google Drive, Files or send anywhere. Plain JSON, CSV and your original photos — never locked in.">
          <Card>
            <LinkRow icon="archive-outline" label="Full backup (.zip)" hint="database.json + photos" busy={busy === "full"} onPress={() => exportAndShare("full", () => createBackupZip(svc, "full"), "application/zip")} />
            <LinkRow icon="document-text-outline" label="Export wardrobe (JSON)" hint="Human-readable" busy={busy === "json"} onPress={() => exportAndShare("json", () => exportWardrobeJson(svc), "application/json")} />
            <LinkRow icon="grid-outline" label="Export CSV" hint="For spreadsheets" busy={busy === "csv"} onPress={() => exportAndShare("csv", () => exportCsv(svc), "text/csv")} />
            <LinkRow icon="images-outline" label="Export photos (.zip)" hint="Original images" busy={busy === "images"} onPress={() => exportAndShare("images", () => createBackupZip(svc, "images"), "application/zip")} />
          </Card>
          <Muted style={{ marginTop: 8 }}>Tip: back up regularly — uninstalling the app deletes its data.</Muted>
        </Section>

        <Section title="Restore / import wardrobe" description="From a wardrobe-backup.zip made by this app or the computer version.">
          <Button title="Restore a backup…" icon="cloud-upload-outline" variant="outline" onPress={() => setRestoreOpen(true)} />
        </Section>

        <Section title="Danger zone">
          <Button title="Delete all wardrobe data" icon="trash-outline" variant="outline" onPress={() => setWipeOpen(true)} style={{ borderColor: "#F0C9C4" }} />
        </Section>

        <Muted style={{ textAlign: "center" }}>Wardrobe works fully offline. Claude is used only through your own chats — this app never contacts any AI service.</Muted>
      </ScrollView>

      <RestoreSheet
        visible={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onRestore={async (uri, mode) => {
          const res = await restoreBackup(svc, uri, mode);
          if (res.ok) {
            await refresh();
            loadStats();
          }
          return res;
        }}
      />
      <WipeSheet
        visible={wipeOpen}
        onClose={() => setWipeOpen(false)}
        onWipe={async () => {
          await wipeWardrobe(svc);
          await refresh();
          loadStats();
          toast("Wardrobe deleted");
        }}
      />
    </Screen>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View>
      <Title style={{ fontSize: 19 }}>{title}</Title>
      {description ? <Muted style={{ marginTop: 2, marginBottom: 10 }}>{description}</Muted> : <View style={{ height: 10 }} />}
      {children}
    </View>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.mutedForeground }}>{label}</Text>
      <Text style={{ color: colors.foreground }}>{value}</Text>
    </View>
  );
}

function LinkRow({ icon, label, hint, onPress, busy }: { icon: IconName; label: string; hint: string; onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }, pressed && { backgroundColor: colors.accent }]}>
      <Ionicons name={icon} size={20} color={colors.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: colors.foreground }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.mutedForeground }}>{busy ? "Preparing…" : hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function RestoreSheet({ visible, onClose, onRestore }: { visible: boolean; onClose: () => void; onRestore: (uri: string, mode: RestoreMode) => Promise<RestoreResult> }) {
  const [file, setFile] = useState<{ uri: string; name: string } | null>(null);
  const [mode, setMode] = useState<RestoreMode>("merge");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const pick = async () => {
    // Read in place via content:// (see src/platform/pickers.ts for why we don't copy).
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/zip", "application/json", "application/octet-stream", "*/*"], copyToCacheDirectory: false });
    if (!r.canceled) {
      setFile({ uri: r.assets[0].uri, name: r.assets[0].name });
      setResult(null);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Restore backup"
      footer={
        <Button
          title="Restore"
          style={{ flex: 1 }}
          variant={mode === "replace" ? "destructive" : "default"}
          loading={busy}
          disabled={!file || (mode === "replace" && confirm !== "REPLACE")}
          onPress={async () => {
            if (!file) return;
            setBusy(true);
            setResult(await onRestore(file.uri, mode));
            setBusy(false);
          }}
        />
      }
    >
      <View style={{ gap: 14 }}>
        <Button title={file ? file.name : "Choose wardrobe-backup.zip"} icon="folder-open-outline" variant="outline" onPress={pick} />
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "merge", label: "Add to wardrobe" },
            { value: "replace", label: "Replace everything" },
          ]}
        />
        <Muted>
          {mode === "merge"
            ? "Adds items and outfits from the backup that aren't already here (matched by ID). Nothing is deleted."
            : "Deletes your current wardrobe and restores exactly what is in the backup."}
        </Muted>
        {mode === "replace" && <Field value={confirm} onChangeText={setConfirm} placeholder="Type REPLACE to confirm" autoCapitalize="characters" />}
        {result && !result.ok && <Banner tone="error">{result.errors.join("\n")}</Banner>}
        {result?.ok && (
          <Banner tone="success">
            <Body>
              Restored {result.itemsRestored} items and {result.outfitsRestored} outfits.
              {result.itemsSkipped + result.outfitsSkipped > 0 ? ` Skipped ${result.itemsSkipped + result.outfitsSkipped} already here.` : ""}
              {result.missingImages.length ? ` ${result.missingImages.length} photos were missing from the backup.` : ""}
            </Body>
          </Banner>
        )}
      </View>
    </Sheet>
  );
}

function WipeSheet({ visible, onClose, onWipe }: { visible: boolean; onClose: () => void; onWipe: () => Promise<void> }) {
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      visible={visible}
      onClose={() => {
        setConfirm("");
        onClose();
      }}
      title="Delete everything?"
      description="All clothing items, photos and outfits will be permanently deleted from this phone. Make a full backup first if you might want them back."
      footer={
        <Button
          title="Delete everything"
          variant="destructive"
          style={{ flex: 1 }}
          loading={busy}
          disabled={confirm !== "DELETE"}
          onPress={async () => {
            setBusy(true);
            await onWipe();
            setBusy(false);
            setConfirm("");
            onClose();
          }}
        />
      }
    >
      <Field value={confirm} onChangeText={setConfirm} placeholder="Type DELETE to confirm" autoCapitalize="characters" />
    </Sheet>
  );
}
