import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { ClothingImage } from "~/components/clothing-image";
import { EmptyWardrobe } from "~/components/empty-wardrobe";
import { WardrobeBrowser } from "~/components/wardrobe-browser";
import { useWardrobe } from "~/state/wardrobe";
import { IconButton, SectionTitle, type IconName } from "~/ui/primitives";
import { Screen } from "~/ui/screen";
import { colors, radius } from "~/ui/theme";

const ACTIONS: { href: string; label: string; icon: IconName }[] = [
  { href: "/add", label: "Add clothing", icon: "camera-outline" },
  { href: "/import", label: "Import from Claude", icon: "sparkles-outline" },
  { href: "/picker", label: "Outfit picker", icon: "color-wand-outline" },
  { href: "/search", label: "Search", icon: "search-outline" },
];

export default function Home() {
  const { items, outfits } = useWardrobe();
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
  return (
    <Screen inTabs
      large
      title="My Wardrobe"
      subtitle={items.length ? `${plural(items.length, "item")} · ${plural(outfits.length, "outfit")}` : undefined}
      actions={<IconButton icon="add" label="Add clothing" onPress={() => router.push("/add")} />}
    >
      {items.length === 0 ? (
        <ScrollView>
          <EmptyWardrobe />
        </ScrollView>
      ) : (
        <WardrobeBrowser
          header={
            <View style={{ gap: 22, paddingBottom: 16 }}>
              <View style={{ flexDirection: "row" }}>
                {ACTIONS.map((a) => (
                  <Pressable key={a.href} onPress={() => router.push(a.href as never)} style={{ flex: 1, alignItems: "center", gap: 6 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={a.icon} size={21} color={colors.foreground} />
                    </View>
                    <Text style={{ fontSize: 11, color: colors.mutedForeground, textAlign: "center" }}>{a.label}</Text>
                  </Pressable>
                ))}
              </View>
              {items.length > 3 && (
                <View>
                  <SectionTitle>Recently added</SectionTitle>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                    {items.slice(0, 10).map((i) => (
                      <Pressable key={i.id} onPress={() => router.push(`/item/${i.id}`)} style={{ width: 108 }}>
                        <ClothingImage imagePath={i.imagePath} style={{ width: 108, aspectRatio: 3 / 4, borderRadius: radius.md }} />
                        <Text numberOfLines={1} style={{ fontSize: 12, marginTop: 6, color: colors.foreground }}>{i.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
              <SectionTitle style={{ marginBottom: -12 }}>All clothes</SectionTitle>
            </View>
          }
        />
      )}
    </Screen>
  );
}
