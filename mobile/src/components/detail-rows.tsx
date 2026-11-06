import { Text, View } from "react-native";
import { humanize } from "@/lib/constants/categories";
import type { ClothingItem, EditableField } from "@/lib/types";
import { Card } from "~/ui/primitives";
import { useColors } from "~/ui/theme";
import { fieldOrigin, OriginMark } from "./provenance";

export type Row = { field: EditableField; label: string; value: string | string[] | null };

export function DetailRows({ item, rows }: { item: ClothingItem; rows: Row[] }) {
  const colors = useColors();
  const visible = rows.filter((r) => (Array.isArray(r.value) ? r.value.length > 0 : Boolean(r.value)));
  if (!visible.length) return null;
  return (
    <Card>
      {visible.map((r, i) => (
        <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.mutedForeground, fontSize: 14 }}>{r.label}</Text>
            <OriginMark origin={fieldOrigin(item, r.field)} />
          </View>
          {Array.isArray(r.value) ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 4, flexShrink: 1 }}>
              {r.value.map((v) => (
                <View key={v} style={{ backgroundColor: colors.muted, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 12 }}>{humanize(v)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 14, color: colors.foreground, flexShrink: 1, textAlign: "right" }}>{humanize(r.value as string)}</Text>
          )}
        </View>
      ))}
    </Card>
  );
}
