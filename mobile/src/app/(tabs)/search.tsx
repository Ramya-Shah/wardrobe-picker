import { ScrollView } from "react-native";
import { EmptyWardrobe } from "~/components/empty-wardrobe";
import { WardrobeBrowser } from "~/components/wardrobe-browser";
import { useWardrobe } from "~/state/wardrobe";
import { Muted } from "~/ui/primitives";
import { Screen } from "~/ui/screen";

export default function SearchScreen() {
  const { items } = useWardrobe();
  return (
    <Screen inTabs title="Search">
      {items.length === 0 ? (
        <ScrollView>
          <EmptyWardrobe />
        </ScrollView>
      ) : (
        <WardrobeBrowser
          showFilters
          empty={<Muted style={{ textAlign: "center", paddingVertical: 40 }}>Nothing matches. Try “black shirt”, “summer”, “college” or “striped”.</Muted>}
        />
      )}
    </Screen>
  );
}
