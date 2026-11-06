import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";
import { Button, Muted, Title } from "~/ui/primitives";
import { useColors } from "~/ui/theme";

export function EmptyWardrobe() {
  const colors = useColors();
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 24, paddingVertical: 48 }}>
      <View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
        <Ionicons name="shirt-outline" size={38} color={colors.mutedForeground} />
      </View>
      <Title>No clothes yet.</Title>
      <Muted style={{ textAlign: "center", marginTop: 8, fontSize: 14, maxWidth: 280 }}>Add your first clothing photo or import metadata from Claude.</Muted>
      <View style={{ width: "100%", maxWidth: 300, gap: 10, marginTop: 24 }}>
        <Button title="Import from Claude" icon="sparkles-outline" size="lg" onPress={() => router.push("/import")} />
        <Button title="Add clothing" icon="camera-outline" size="lg" variant="outline" onPress={() => router.push("/add")} />
      </View>
    </View>
  );
}
