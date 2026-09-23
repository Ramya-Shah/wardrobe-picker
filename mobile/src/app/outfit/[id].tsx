import { router, useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, View } from "react-native";
import { humanize } from "@/lib/constants/categories";
import { OutfitPieces } from "~/components/outfit-card";
import { deleteOutfit } from "~/core/outfits";
import { useWardrobe } from "~/state/wardrobe";
import { Badge, Body, IconButton, Muted, SectionTitle } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { useToast } from "~/ui/toast";
import { colors, radius } from "~/ui/theme";

export default function OutfitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { svc, outfits, refresh } = useWardrobe();
  const toast = useToast();
  const outfit = outfits.find((o) => o.id === id);
  if (!outfit) {
    return (
      <Screen title="Not found" back>
        <Body style={{ padding: 16 }}>This outfit doesn’t exist.</Body>
      </Screen>
    );
  }
  const remove = () =>
    Alert.alert(`Delete “${outfit.name}”?`, "The clothes stay in your wardrobe; only this outfit is removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteOutfit(svc.db, outfit.id);
          await refresh();
          toast("Outfit deleted");
          router.back();
        },
      },
    ]);
  return (
    <Screen title={outfit.name} back actions={<IconButton icon="trash-outline" label="Delete outfit" onPress={remove} />}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {outfit.occasion ? <Badge label={humanize(outfit.occasion)} tone="outline" /> : null}
          {outfit.season ? <Badge label={humanize(outfit.season)} tone="outline" /> : null}
          {outfit.style ? <Badge label={humanize(outfit.style)} tone="outline" /> : null}
          {outfit.source === "claude" ? <Badge label="Claude" tone="ai" /> : null}
        </View>
        <OutfitPieces pieces={outfit.items} />
        {outfit.description ? <Body>{outfit.description}</Body> : null}
        {outfit.explanation ? (
          <View style={{ backgroundColor: colors.muted, borderRadius: radius.lg, padding: 14 }}>
            <SectionTitle style={{ marginBottom: 4 }}>Why it works</SectionTitle>
            <Body>{outfit.explanation}</Body>
          </View>
        ) : null}
        <Muted>Saved {new Date(outfit.createdAt).toLocaleDateString()}</Muted>
      </ScrollView>
    </Screen>
  );
}
