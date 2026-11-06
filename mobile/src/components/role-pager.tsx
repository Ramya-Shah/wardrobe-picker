import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { FlatList, Pressable, Text, useWindowDimensions, View } from "react-native";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import type { ClothingItem } from "@/lib/types";
import { IconButton } from "~/ui/primitives";
import { radius, useColors } from "~/ui/theme";
import { ClothingImage } from "./clothing-image";

const PHOTO_HEIGHT = 190;

/**
 * One swipeable row of the outfit builder (e.g. all your tops). `null` = "none" for
 * optional pieces. Locked rows can't be swiped and are kept when shuffling.
 */
export function RolePager({
  label,
  options,
  selectedId,
  onSelect,
  locked,
  onToggleLock,
  emptyText,
}: {
  label: string;
  options: (ClothingItem | null)[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  locked: boolean;
  onToggleLock: () => void;
  emptyText: string;
}) {
  const colors = useColors();
  const { width: screen } = useWindowDimensions();
  const width = screen - 32;
  const ref = useRef<FlatList<ClothingItem | null>>(null);
  const index = Math.max(0, options.findIndex((o) => (o?.id ?? null) === selectedId));

  // Follow selection changes that didn't come from swiping (shuffle, filters, arrows).
  useEffect(() => {
    if (options.length) ref.current?.scrollToIndex({ index, animated: true });
  }, [index, options.length]);

  const go = (delta: number) => {
    if (!options.length || locked) return;
    const next = (index + delta + options.length) % options.length;
    onSelect(options[next]?.id ?? null);
  };
  const realCount = options.filter(Boolean).length;
  const position = options[index] ? options.slice(0, index + 1).filter(Boolean).length : 0;

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontSize: 12, letterSpacing: 0.8, color: colors.mutedForeground }}>
          {label.toUpperCase()}
          {realCount ? `  ·  ${position ? `${position}/${realCount}` : "none"}` : ""}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <IconButton icon="chevron-back" label={`Previous ${label}`} onPress={() => go(-1)} color={locked ? colors.input : colors.foreground} />
          <IconButton icon="chevron-forward" label={`Next ${label}`} onPress={() => go(1)} color={locked ? colors.input : colors.foreground} />
          <IconButton icon={locked ? "lock-closed" : "lock-open-outline"} label={locked ? `Unlock ${label}` : `Lock ${label}`} onPress={onToggleLock} color={locked ? colors.foreground : colors.mutedForeground} />
        </View>
      </View>
      {options.length === 0 ? (
        <View style={{ height: PHOTO_HEIGHT + 40, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.input, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: colors.mutedForeground }}>{emptyText}</Text>
        </View>
      ) : (
        <FlatList
          ref={ref}
          data={options}
          horizontal
          pagingEnabled
          scrollEnabled={!locked}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(o) => o?.id ?? "none"}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          initialScrollIndex={index}
          initialNumToRender={3}
          windowSize={5}
          onMomentumScrollEnd={(e) => {
            const i = Math.round(e.nativeEvent.contentOffset.x / width);
            const picked = options[Math.min(Math.max(i, 0), options.length - 1)];
            if ((picked?.id ?? null) !== selectedId) onSelect(picked?.id ?? null);
          }}
          renderItem={({ item }) => (
            <View style={{ width, alignItems: "center" }}>
              {item ? (
                <Pressable onPress={() => router.push(`/item/${item.id}`)} style={{ alignItems: "center" }}>
                  <View style={{ height: PHOTO_HEIGHT, aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.muted, borderWidth: locked ? 2 : 0, borderColor: colors.primary }}>
                    <ClothingImage imagePath={item.imagePath} style={{ width: "100%", height: "100%" }} />
                  </View>
                  <Text numberOfLines={1} style={{ marginTop: 6, fontSize: 14, color: colors.foreground, maxWidth: width - 40 }}>{item.name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedForeground }}>{[categoryLabel(item.category), humanize(item.primaryColor)].filter(Boolean).join(" · ")}</Text>
                </Pressable>
              ) : (
                <View style={{ height: PHOTO_HEIGHT + 40, width: PHOTO_HEIGHT * 0.75, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: colors.input, alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Ionicons name="remove-circle-outline" size={24} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground, fontSize: 13 }}>No {label.toLowerCase()}</Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>swipe for options</Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}
