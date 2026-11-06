import { router } from "expo-router";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { IconButton, Muted, Title } from "./primitives";
import { type Palette, useStyles } from "./theme";

/** Screen with a title bar: optional back button, large serif title, right-side actions. */
export function Screen({
  title,
  subtitle,
  back = false,
  large = false,
  actions,
  children,
  style,
  inTabs = false,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  large?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  /** Tab screens: the tab bar already handles the bottom inset. */
  inTabs?: boolean;
}) {
  const styles = useStyles(makeStyles);
  return (
    <SafeAreaView edges={inTabs ? ["top"] : ["top", "bottom"]} style={[styles.safe, style]}>
      <View style={styles.header}>
        {back && <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} />}
        <View style={{ flex: 1, marginLeft: back ? 4 : 0 }}>
          <Title numberOfLines={1} style={large ? { fontSize: 30, lineHeight: 38 } : { fontSize: 21 }}>
            {title}
          </Title>
          {subtitle ? <Muted numberOfLines={1}>{subtitle}</Muted> : null}
        </View>
        {actions ? <View style={{ flexDirection: "row", gap: 4 }}>{actions}</View> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, minHeight: 56 },
});
