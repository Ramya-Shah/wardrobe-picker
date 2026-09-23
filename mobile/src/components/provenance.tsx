import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import type { ClothingItem, EditableField } from "@/lib/types";
import { colors } from "~/ui/theme";

export type FieldOrigin = "edited" | "inferred" | "ai" | "manual";

export function fieldOrigin(item: Pick<ClothingItem, "aiGenerated" | "editedFields" | "inferredFields">, field: EditableField): FieldOrigin {
  if (item.editedFields.includes(field)) return "edited";
  if (item.aiGenerated && item.inferredFields.includes(field)) return "inferred";
  return item.aiGenerated ? "ai" : "manual";
}

/** Only notable origins are marked: Claude's guesses and your own corrections. */
export function OriginMark({ origin }: { origin: FieldOrigin }) {
  if (origin === "edited") return <Ionicons name="pencil" size={11} color={colors.success} accessibilityLabel="Edited by you" />;
  if (origin === "inferred")
    return (
      <View style={{ backgroundColor: "#EEEAF8", borderRadius: 8, paddingHorizontal: 5 }}>
        <Text style={{ fontSize: 10, color: colors.ai }}>inferred</Text>
      </View>
    );
  return null;
}
