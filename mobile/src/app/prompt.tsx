import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { ScrollView, Share, Text, View } from "react-native";
import { filenameListMessage, WARDROBE_PROMPT } from "@/lib/export/claude-prompt";
import { pickPhotos } from "~/platform/pickers";
import { Body, Button, Card, Muted } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { radius, useColors } from "~/ui/theme";

/** The Claude wardrobe prompt (same text as docs/CLAUDE_WARDROBE_PROMPT.md). */
export default function PromptScreen() {
  const colors = useColors();
  const toast = useToast();
  const [names, setNames] = useState<string[]>([]);
  const text = names.length ? `${WARDROBE_PROMPT}\n${filenameListMessage(names)}\n` : WARDROBE_PROMPT;
  return (
    <Screen title="Claude prompt" back>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 32 }}>
        <View style={{ gap: 4 }}>
          <Body>1. Copy or share this prompt to the Claude app.</Body>
          <Body>2. Attach your clothing photos (1 or many; ~20 per message works well).</Body>
          <Body>3. Copy Claude’s JSON reply, then Import from Claude with the same photos.</Body>
        </View>
        <Card style={{ padding: 12, gap: 8 }}>
          <Muted>{names.length ? `Filename list added for ${names.length} photo${names.length === 1 ? "" : "s"}.` : "Optional: pick the photos you’ll send so the prompt lists their filenames — this helps Claude fill in the “image” field correctly."}</Muted>
          <Button title={names.length ? "Pick different photos" : "Add photo filenames"} icon="images-outline" size="sm" variant="outline" onPress={async () => setNames((await pickPhotos(true)).map((p) => p.name))} />
        </Card>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button
            title="Copy prompt"
            icon="copy-outline"
            style={{ flex: 1 }}
            onPress={async () => {
              await Clipboard.setStringAsync(text);
              toast("Copied — paste it into Claude");
            }}
          />
          <Button title="Share" icon="share-social-outline" variant="outline" style={{ flex: 1 }} onPress={() => Share.share({ message: text })} />
        </View>
        <View style={{ backgroundColor: colors.muted, borderRadius: radius.md, padding: 12 }}>
          <Text selectable style={{ fontFamily: "monospace", fontSize: 11, lineHeight: 16, color: colors.foreground }}>
            {text}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
