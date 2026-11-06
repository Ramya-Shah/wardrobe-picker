import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Text, View } from "react-native";
import { createBackupZip } from "~/core/backup";
import { daysSinceBackup, isBackupDue } from "~/core/settings";
import { useWardrobe } from "~/state/wardrobe";
import { Banner, Button } from "~/ui/primitives";
import { useToast } from "~/ui/toast";
import { useColors } from "~/ui/theme";

/** Make a full backup zip, open the share sheet (Drive, Files…), and remember when. */
export function useBackupNow() {
  const { svc, updateSettings } = useWardrobe();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const backupNow = async () => {
    setBusy(true);
    try {
      const path = await createBackupZip(svc, "full");
      await updateSettings({ lastBackupAt: new Date().toISOString(), backupSnoozedUntil: null });
      await Sharing.shareAsync(path, { mimeType: "application/zip", dialogTitle: "Save your wardrobe backup" });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return { backupNow, busy };
}

/** Home-screen reminder shown when a backup is due (see Settings → Backup reminder). */
export function BackupReminder() {
  const { items, settings, updateSettings } = useWardrobe();
  const { backupNow, busy } = useBackupNow();
  const colors = useColors();
  if (!isBackupDue(settings, items.length)) return null;
  const days = daysSinceBackup(settings);
  return (
    <Banner tone="warning" icon="cloud-upload-outline">
      <View style={{ gap: 10 }}>
        <Text style={{ color: colors.foreground, fontSize: 14, lineHeight: 20 }}>
          {days === null ? "You haven’t backed up your wardrobe yet." : `Your last backup was ${days} day${days === 1 ? "" : "s"} ago.`} Everything lives only on this phone — save a copy to Drive or Files.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Back up now" size="sm" loading={busy} onPress={backupNow} />
          <Button
            title="Later"
            size="sm"
            variant="ghost"
            onPress={() => updateSettings({ backupSnoozedUntil: new Date(Date.now() + 3 * 86_400_000).toISOString() })}
          />
        </View>
      </View>
    </Banner>
  );
}
