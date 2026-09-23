import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import type { ClothingItem } from "@/lib/types";
import { colors, radius } from "~/ui/theme";
import { ClothingImage } from "./clothing-image";

/** Grid card: the photo is the hero; name, category · color and two tags underneath. */
export function ClothingCard({
  item,
  selectable,
  selected,
  onPress,
  note,
}: {
  item: ClothingItem;
  selectable?: boolean;
  selected?: boolean;
  onPress?: () => void;
  note?: string;
}) {
  const meta = [categoryLabel(item.category), humanize(item.primaryColor)].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/item/${item.id}`))}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={selectable ? { selected } : undefined}
      style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}
    >
      <View style={[styles.photo, selected && styles.selected]}>
        <ClothingImage imagePath={item.imagePath} style={StyleSheet.absoluteFill} />
        {selectable && (
          <View style={[styles.check, selected ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}>
            {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.name}>
        {item.name}
      </Text>
      <Text numberOfLines={1} style={styles.meta}>
        {meta}
      </Text>
      {item.tags.length > 0 && (
        <Text numberOfLines={1} style={styles.tags}>
          {item.tags.slice(0, 2).map((t) => `#${t}`).join("  ")}
        </Text>
      )}
      {note ? (
        <Text numberOfLines={2} style={[styles.tags, { color: colors.success }]}>
          {note}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.muted },
  selected: { borderWidth: 3, borderColor: colors.primary },
  check: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: "#fff", backgroundColor: "rgba(0,0,0,0.15)", alignItems: "center", justifyContent: "center" },
  name: { marginTop: 8, fontSize: 14, fontWeight: "500", color: colors.foreground },
  meta: { fontSize: 12, color: colors.mutedForeground },
  tags: { fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
});
