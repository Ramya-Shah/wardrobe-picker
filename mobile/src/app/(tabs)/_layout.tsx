import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { useColors } from "~/ui/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const icon = (name: IconName, active: IconName) =>
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? active : name} size={23} color={color as string} />;
  };

export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Wardrobe", tabBarIcon: icon("shirt-outline", "shirt") }} />
      <Tabs.Screen name="search" options={{ title: "Search", tabBarIcon: icon("search-outline", "search") }} />
      <Tabs.Screen name="outfits" options={{ title: "Outfits", tabBarIcon: icon("sparkles-outline", "sparkles") }} />
      <Tabs.Screen name="settings" options={{ title: "Settings", tabBarIcon: icon("settings-outline", "settings") }} />
    </Tabs>
  );
}
