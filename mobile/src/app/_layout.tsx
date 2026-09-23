import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { WardrobeProvider } from "~/state/wardrobe";
import { ToastProvider } from "~/ui/toast";
import { colors } from "~/ui/theme";

function Loading({ error }: { error: string | null }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background, padding: 24 }}>
      {error ? (
        <Text style={{ color: colors.destructive, textAlign: "center" }}>Couldn’t open your wardrobe: {error}</Text>
      ) : (
        <ActivityIndicator color={colors.mutedForeground} />
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ToastProvider>
        <WardrobeProvider fallback={(error) => <Loading error={error} />}>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }} />
        </WardrobeProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
