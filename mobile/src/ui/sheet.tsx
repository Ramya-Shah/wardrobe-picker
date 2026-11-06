import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Muted, Title } from "./primitives";
import { radius, type Palette, useStyles } from "./theme";

/** Bottom sheet (mobile-friendly modal) with a scrolling body and an optional pinned footer. */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
  footer,
  tall = false,
  scroll = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  tall?: boolean;
  scroll?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, tall && { height: "92%" }, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Title style={{ fontSize: 20 }}>{title}</Title>
              {description ? <Muted style={{ marginTop: 2 }}>{description}</Muted> : null}
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          {scroll ? (
            <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.overlay },
  sheet: { maxHeight: "92%", backgroundColor: colors.background, borderTopLeftRadius: radius.xl + 8, borderTopRightRadius: radius.xl + 8 },
  grabber: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: colors.input, marginTop: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 8 },
  footer: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
