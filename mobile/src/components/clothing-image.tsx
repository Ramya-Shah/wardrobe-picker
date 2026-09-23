import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { View, type ImageStyle, type StyleProp } from "react-native";
import { imageFile, thumbFile } from "~/core/images";
import { useWardrobe } from "~/state/wardrobe";
import { colors } from "~/ui/theme";

/** A clothing photo from the phone's storage: the ~480px thumbnail by default, or the original. */
export function ClothingImage({
  imagePath,
  size = "thumb",
  style,
  contentFit = "cover",
}: {
  imagePath: string | null | undefined;
  size?: "thumb" | "full";
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
}) {
  const { svc } = useWardrobe();
  const [useOriginal, setUseOriginal] = useState(false);
  if (!imagePath) {
    return (
      <View style={[{ backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }, style as object]}>
        <Ionicons name="shirt-outline" size={30} color={colors.input} />
      </View>
    );
  }
  const uri = size === "full" || useOriginal ? imageFile(svc, imagePath) : thumbFile(svc, imagePath);
  return (
    <Image
      source={uri ? { uri } : null}
      style={[{ backgroundColor: colors.muted }, style]}
      contentFit={contentFit}
      transition={120}
      recyclingKey={imagePath}
      // If a thumbnail is missing (e.g. it failed to generate), fall back to the original.
      onError={() => size === "thumb" && setUseOriginal(true)}
    />
  );
}
