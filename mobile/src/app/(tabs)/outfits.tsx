import { router } from "expo-router";
import { FlatList, View } from "react-native";
import { OutfitCard } from "~/components/outfit-card";
import { useWardrobe } from "~/state/wardrobe";
import { Body, Button, Title } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { radius, useColors } from "~/ui/theme";

export default function OutfitsScreen() {
  const colors = useColors();
  const { outfits, items } = useWardrobe();
  return (
    <Screen inTabs large title="Outfits" subtitle={outfits.length ? `${outfits.length} saved` : undefined}>
      <FlatList
        data={outfits}
        keyExtractor={(o) => o.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 18 }}
        ListHeaderComponent={
          <View style={{ gap: 8, paddingBottom: 8 }}>
            <Button title="Build an outfit" icon="color-wand-outline" onPress={() => router.push("/builder")} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button title="Ask Claude" icon="sparkles-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push("/picker")} />
              <Button title="Import outfit" icon="code-download-outline" variant="outline" style={{ flex: 1 }} onPress={() => router.push("/outfit-import")} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.input, borderRadius: radius.lg, padding: 28, alignItems: "center" }}>
            <Title style={{ fontSize: 20 }}>No outfits yet</Title>
            <Body style={{ textAlign: "center", marginTop: 6, color: colors.mutedForeground }}>
              {items.length === 0
                ? "Add some clothes first, then build outfits around them."
                : "Use the Outfit picker to gather candidates, ask Claude to put an outfit together, then import its answer."}
            </Body>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ flex: 1, maxWidth: "50%" }}>
            <OutfitCard outfit={item} />
          </View>
        )}
      />
    </Screen>
  );
}
