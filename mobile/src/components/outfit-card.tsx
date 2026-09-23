import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import { OUTFIT_ROLE_LABELS, OUTFIT_ROLES, type OutfitRole } from "@/lib/constants/vocab";
import type { ClothingItemSummary, Outfit } from "@/lib/types";
import { useWardrobe } from "~/state/wardrobe";
import { colors, radius } from "~/ui/theme";
import { ClothingImage } from "./clothing-image";

/** Outfit tile: a 2×2 collage of the actual clothing photos. */
export function OutfitCard({ outfit }: { outfit: Outfit }) {
  const { itemsById } = useWardrobe();
  const pieces = outfit.items.map((i) => itemsById.get(i.clothingItemId)).filter(Boolean).slice(0, 4);
  return (
    <Pressable onPress={() => router.push(`/outfit/${outfit.id}`)} style={({ pressed }) => [{ flex: 1 }, pressed && { opacity: 0.8 }]}>
      <View style={styles.collage}>
        {pieces.map((p) => (
          <View key={p!.id} style={{ width: pieces.length === 1 ? "100%" : "50%", height: pieces.length <= 2 ? "100%" : "50%", padding: 1 }}>
            <ClothingImage imagePath={p!.imagePath} style={{ width: "100%", height: "100%" }} />
          </View>
        ))}
      </View>
      <Text numberOfLines={1} style={{ marginTop: 8, fontSize: 14, fontWeight: "500", color: colors.foreground }}>
        {outfit.name}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedForeground }}>
        {[humanize(outfit.occasion), `${outfit.items.length} pieces`].filter(Boolean).join(" · ")}
      </Text>
    </Pressable>
  );
}

const ORDER = new Map(OUTFIT_ROLES.map((r, i) => [r, i]));

/** The actual clothing photos of an outfit, top to toe. */
export function OutfitPieces({ pieces }: { pieces: { role: string; clothingItemId: string; item: ClothingItemSummary | null }[] }) {
  const { itemsById } = useWardrobe();
  const sorted = [...pieces].sort((a, b) => (ORDER.get(a.role as OutfitRole) ?? 9) - (ORDER.get(b.role as OutfitRole) ?? 9));
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {sorted.map((p) => {
        const full = itemsById.get(p.clothingItemId);
        return (
          <Pressable key={p.clothingItemId} disabled={!full} onPress={() => router.push(`/item/${p.clothingItemId}`)} style={{ width: "47%" }}>
            <View style={styles.piece}>
              {full ? (
                <ClothingImage imagePath={full.imagePath} style={StyleSheet.absoluteFill} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", padding: 8 }]}>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, textAlign: "center" }}>Missing item {p.clothingItemId}</Text>
                </View>
              )}
            </View>
            <Text style={{ marginTop: 6, fontSize: 11, letterSpacing: 0.5, color: colors.mutedForeground }}>{(OUTFIT_ROLE_LABELS[p.role as OutfitRole] ?? p.role).toUpperCase()}</Text>
            {full && (
              <>
                <Text numberOfLines={1} style={{ fontSize: 14, color: colors.foreground }}>{full.name}</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, color: colors.mutedForeground }}>{[categoryLabel(full.category), humanize(full.primaryColor)].filter(Boolean).join(" · ")}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  collage: { aspectRatio: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.muted, flexDirection: "row", flexWrap: "wrap" },
  piece: { aspectRatio: 3 / 4, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.muted },
});
