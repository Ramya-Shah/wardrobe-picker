import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useWardrobe, WardrobeProvider } from "~/state/wardrobe";
import { ThemeProvider, useTheme } from "~/ui/theme";
import { ToastProvider } from "~/ui/toast";

function Loading({ error }: { error: string | null }) {
  const { colors } = useTheme();
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

function ThemedApp() {
  const { colors, dark } = useTheme();
  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: "slide_from_right" }} />
      </ToastProvider>
    </>
  );
}

/** Applies the theme chosen in Settings (System / Light / Dark). */
function WithUserTheme() {
  const { settings } = useWardrobe();
  return (
    <ThemeProvider preference={settings.theme}>
      <ThemedApp />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Follows the phone's light/dark setting until the saved preference is loaded. */}
      <ThemeProvider>
        <WardrobeProvider fallback={(error) => <Loading error={error} />}>
          <WithUserTheme />
        </WardrobeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
