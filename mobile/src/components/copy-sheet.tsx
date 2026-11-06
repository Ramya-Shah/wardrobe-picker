import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import { Share, Text, View } from "react-native";
import { joinPath } from "~/core/services";
import { useWardrobe } from "~/state/wardrobe";
import { Button, Muted } from "~/ui/primitives";
import { Sheet } from "~/ui/sheet";
import { useToast } from "~/ui/toast";
import { radius, useColors } from "~/ui/theme";

// Android refuses very large text in share intents / clipboard; beyond this, share a .txt file instead.
const LARGE = 200_000;

/** Shows text for Claude with Copy, Share (e.g. straight to the Claude app) and Share-as-file. */
export function CopySheet({
  visible,
  onClose,
  title,
  description,
  text,
  filename,
  extraFooter,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  text: string;
  filename: string;
  extraFooter?: React.ReactNode;
}) {
  const colors = useColors();
  const { svc } = useWardrobe();
  const toast = useToast();
  const large = text.length > LARGE;

  const copy = async () => {
    try {
      await Clipboard.setStringAsync(text);
      toast("Copied — paste it into Claude");
    } catch {
      toast("Too large for the clipboard — use Share as file.", "error");
    }
  };
  const shareText = async () => {
    try {
      await Share.share({ message: text });
    } catch {
      toast("Couldn't share the text — use Share as file.", "error");
    }
  };
  const shareFile = async () => {
    const dir = joinPath(svc.cacheRoot, "exports");
    await svc.files.ensureDir(dir);
    const path = joinPath(dir, filename);
    await svc.files.writeText(path, text);
    await Sharing.shareAsync(path, { mimeType: filename.endsWith(".json") ? "application/json" : "text/plain", dialogTitle: title });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button title="Copy" icon="copy-outline" style={{ flex: 1 }} onPress={copy} disabled={large} />
            <Button title="Share" icon="share-social-outline" variant="outline" style={{ flex: 1 }} onPress={shareText} disabled={large} />
          </View>
          <Button title="Share as file" icon="document-text-outline" variant="ghost" onPress={shareFile} />
          {extraFooter}
        </View>
      }
    >
      {large && <Muted style={{ marginBottom: 8 }}>This is a lot of text ({Math.round(text.length / 1000)} KB). Share it as a file and attach it in Claude.</Muted>}
      <View style={{ backgroundColor: colors.muted, borderRadius: radius.md, padding: 12 }}>
        <Text selectable style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 16, color: colors.foreground }}>
          {text.length > 6000 ? `${text.slice(0, 6000)}\n\n… (${text.length - 6000} more characters)` : text}
        </Text>
      </View>
    </Sheet>
  );
}
