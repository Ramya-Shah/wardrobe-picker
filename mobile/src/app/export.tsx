import { useMemo, useState } from "react";
import { View } from "react-native";
import { formatItemsAsJson, formatItemsAsText } from "@/lib/export/claude-context";
import { CopySheet } from "~/components/copy-sheet";
import { EmptyWardrobe } from "~/components/empty-wardrobe";
import { WardrobeBrowser } from "~/components/wardrobe-browser";
import { useWardrobe } from "~/state/wardrobe";
import { Button, Muted, Segmented } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useColors } from "~/ui/theme";

/** Select items (or everything) and copy/share them as context for Claude. */
export default function ExportScreen() {
  const colors = useColors();
  const { items } = useWardrobe();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<"text" | "json">("text");
  const [text, setText] = useState<string | null>(null);
  const chosen = useMemo(() => items.filter((i) => selected.has(i.id)), [items, selected]);
  const build = (list: typeof items) => setText(format === "json" ? formatItemsAsJson(list) : formatItemsAsText(list));

  if (!items.length) {
    return (
      <Screen title="Export for Claude" back>
        <EmptyWardrobe />
      </Screen>
    );
  }
  return (
    <Screen title="Export for Claude" back>
      <WardrobeBrowser
        selectable
        selectedIds={selected}
        onToggle={(id) =>
          setSelected((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
          })
        }
      />
      <View style={{ padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Muted style={{ flex: 1 }}>{selected.size} selected{selected.size ? " · tap Clear to start over" : ""}</Muted>
          {selected.size > 0 && <Button title="Clear" size="sm" variant="ghost" onPress={() => setSelected(new Set())} />}
          <View style={{ width: 130 }}>
            <Segmented value={format} onChange={setFormat} options={[{ value: "text", label: "Text" }, { value: "json", label: "JSON" }]} />
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button title="Whole wardrobe" variant="outline" style={{ flex: 1 }} onPress={() => build(items)} />
          <Button title={`Copy ${selected.size || ""} for Claude`} icon="sparkles-outline" style={{ flex: 1.4 }} disabled={!selected.size} onPress={() => build(chosen)} />
        </View>
      </View>
      <CopySheet
        visible={text !== null}
        onClose={() => setText(null)}
        title="Wardrobe context for Claude"
        description="Claude should refer to items only by their IDs."
        text={text ?? ""}
        filename={`wardrobe-context.${format === "json" ? "json" : "txt"}`}
      />
    </Screen>
  );
}
