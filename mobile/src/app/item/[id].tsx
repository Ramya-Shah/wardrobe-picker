import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { categoryLabel, humanize } from "@/lib/constants/categories";
import { PAIRING_KEYS } from "@/lib/constants/vocab";
import { ClothingImage } from "~/components/clothing-image";
import { DetailRows } from "~/components/detail-rows";
import { OutfitCard } from "~/components/outfit-card";
import { fieldOrigin, OriginMark } from "~/components/provenance";
import { duplicateItem } from "~/core/item-actions";
import { imageFile } from "~/core/images";
import { deleteItem, getRawImport } from "~/core/items";
import { useWardrobe } from "~/state/wardrobe";
import { Badge, Body, Card, Muted, SectionTitle, Title, type IconName } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { radius, type Palette, useColors, useStyles } from "~/ui/theme";
import { CopySheet } from "~/components/copy-sheet";

export default function ItemScreen() {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { svc, itemsById, outfits, refresh } = useWardrobe();
  const toast = useToast();
  const [raw, setRaw] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const item = itemsById.get(id);

  if (!item) {
    return (
      <Screen title="Not found" back>
        <Body style={{ padding: 16 }}>This item doesn’t exist — it may have been deleted.</Body>
      </Screen>
    );
  }
  const inOutfits = outfits.filter((o) => o.items.some((i) => i.clothingItemId === item.id));
  const hasPairing = PAIRING_KEYS.some((k) => item.pairingSuggestions[k].length > 0);

  const remove = () => {
    const doDelete = async () => {
      await deleteItem(svc, item.id);
      await refresh();
      toast(`Deleted “${item.name}”`);
      router.back();
    };
    Alert.alert(
      `Delete “${item.name}”?`,
      `This removes the item and its photo${inOutfits.length ? ` and takes it out of ${inOutfits.length} outfit${inOutfits.length === 1 ? "" : "s"}` : ""}. This can’t be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        ...(item.imagePath
          ? [{ text: "Save photo first", onPress: () => Sharing.shareAsync(imageFile(svc, item.imagePath!)!, { mimeType: item.imageMime ?? "image/jpeg" }) }]
          : []),
        { text: "Delete", style: "destructive" as const, onPress: doDelete },
      ],
    );
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const copy = await duplicateItem(svc, item.id);
      await refresh();
      toast("Duplicated");
      router.push(`/edit/${copy.id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title={item.name} back>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ backgroundColor: colors.muted }}>
          <ClothingImage imagePath={item.imagePath} size="full" contentFit="contain" style={{ width: "100%", aspectRatio: item.imageWidth && item.imageHeight ? Math.max(0.6, item.imageWidth / item.imageHeight) : 3 / 4, maxHeight: 560 }} />
        </View>

        <View style={{ padding: 16, gap: 22 }}>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <Badge label={categoryLabel(item.category)} tone="outline" />
              {item.subcategory ? <Badge label={humanize(item.subcategory)} tone="outline" /> : null}
              {item.aiGenerated ? <Badge label="Claude" tone="ai" /> : <Badge label="Manual" />}
              {item.userEdited ? <Badge label="Edited" tone="success" /> : null}
            </View>
            <Title style={{ fontSize: 26, lineHeight: 32 }}>{item.name}</Title>
            {(item.inferredFields.length > 0 || item.userEdited) && (
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                {item.inferredFields.length > 0 && (
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <OriginMark origin="inferred" />
                    <Muted style={{ fontSize: 11 }}>Claude’s guess</Muted>
                  </View>
                )}
                {item.userEdited && (
                  <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                    <OriginMark origin="edited" />
                    <Muted style={{ fontSize: 11 }}>edited by you</Muted>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row" }}>
            <Action icon="pencil-outline" label="Edit" onPress={() => router.push(`/edit/${item.id}`)} />
            <Action icon="color-wand-outline" label="Outfit" onPress={() => router.push(`/builder?item=${item.id}`)} />
            <Action icon="copy-outline" label={busy ? "…" : "Duplicate"} onPress={duplicate} />
            <Action icon="trash-outline" label="Delete" destructive onPress={remove} />
          </View>

          {item.description ? (
            <View>
              <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                <SectionTitle>Description</SectionTitle>
                <View style={{ marginBottom: 8 }}><OriginMark origin={fieldOrigin(item, "description")} /></View>
              </View>
              <Body style={{ color: colors.softForeground }}>{item.description}</Body>
            </View>
          ) : null}

          {item.userNotes ? (
            <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: 14 }}>
              <SectionTitle style={{ marginBottom: 4 }}>My notes</SectionTitle>
              <Body>{item.userNotes}</Body>
            </View>
          ) : null}

          <View>
            <SectionTitle>Details</SectionTitle>
            <DetailRows
              item={item}
              rows={[
                { field: "category", label: "Category", value: categoryLabel(item.category) },
                { field: "subcategory", label: "Type", value: item.subcategory },
                { field: "primaryColor", label: "Color", value: item.primaryColor },
                { field: "secondaryColors", label: "Also", value: item.secondaryColors },
                { field: "pattern", label: "Pattern", value: item.pattern },
                { field: "texture", label: "Texture", value: item.texture },
                { field: "graphic", label: "Graphic", value: item.graphic },
                { field: "logo", label: "Logo", value: item.logo },
                { field: "material", label: "Material", value: item.material },
                { field: "fit", label: "Fit", value: item.fit },
                { field: "sleeveType", label: "Sleeves", value: item.sleeveType },
                { field: "neckline", label: "Neckline", value: item.neckline },
                { field: "length", label: "Length", value: item.length },
                { field: "silhouette", label: "Silhouette", value: item.silhouette },
              ]}
            />
          </View>

          <View>
            <SectionTitle>Style & context</SectionTitle>
            <DetailRows
              item={item}
              rows={[
                { field: "styles", label: "Style", value: item.styles },
                { field: "formality", label: "Formality", value: item.formality },
                { field: "seasons", label: "Seasons", value: item.seasons },
                { field: "occasions", label: "Occasions", value: item.occasions },
                { field: "environments", label: "Where", value: item.environments },
              ]}
            />
          </View>

          {item.tags.length > 0 && (
            <View>
              <SectionTitle>Tags</SectionTitle>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {item.tags.map((t) => (
                  <View key={t} style={styles.tag}>
                    <Text style={{ fontSize: 14 }}>#{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {hasPairing && (
            <View>
              <SectionTitle>Pairs well with</SectionTitle>
              <Card>
                {PAIRING_KEYS.filter((k) => item.pairingSuggestions[k].length).map((k, i) => (
                  <View key={k} style={{ padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
                    <Text style={{ fontSize: 11, letterSpacing: 0.6, color: colors.mutedForeground }}>{k.toUpperCase()}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                      {item.pairingSuggestions[k].map((s) => (
                        <View key={s} style={[styles.tag, { backgroundColor: colors.muted, borderWidth: 0 }]}>
                          <Text style={{ fontSize: 14 }}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          )}

          {inOutfits.length > 0 && (
            <View>
              <SectionTitle>In outfits</SectionTitle>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {inOutfits.map((o) => (
                  <View key={o.id} style={{ width: "47%" }}>
                    <OutfitCard outfit={o} />
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 3 }}>
            <Muted>ID: {item.id}</Muted>
            {item.originalFilename ? <Muted>Original file: {item.originalFilename}</Muted> : null}
            <Muted>Added {new Date(item.createdAt).toLocaleDateString()} · Updated {new Date(item.updatedAt).toLocaleDateString()}</Muted>
            {item.aiGenerated && (
              <Pressable onPress={async () => setRaw((await getRawImport(svc.db, item.id)) ?? "No imported JSON stored.")}>
                <Muted style={{ textDecorationLine: "underline" }}>Original Claude JSON</Muted>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
      <CopySheet visible={raw !== null} onClose={() => setRaw(null)} title="Original Claude JSON" text={raw ?? ""} filename={`${item.id}-claude.json`} />
    </Screen>
  );
}

function Action({ icon, label, onPress, destructive }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean }) {
  const colors = useColors();
  const color = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ flex: 1, alignItems: "center", gap: 6 }, pressed && { opacity: 0.6 }]}>
      <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={21} color={color} />
      </View>
      <Text style={{ fontSize: 12, color }}>{label}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  tag: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
});
