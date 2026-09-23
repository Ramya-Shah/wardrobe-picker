import { Ionicons } from "@expo/vector-icons";
import { forwardRef } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { colors, fonts, radius } from "./theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Title({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontFamily: fonts.serif, fontSize: 24, color: colors.foreground }, style]} />;
}

export function Body({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontSize: 15, lineHeight: 22, color: colors.foreground }, style]} />;
}

export function Muted({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontSize: 13, lineHeight: 18, color: colors.mutedForeground }, style]} />;
}

export function Label({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontSize: 13, fontWeight: "500", color: colors.mutedForeground, marginBottom: 6 }, style]} />;
}

export function SectionTitle({ style, ...p }: TextProps) {
  return <Text {...p} style={[{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8 }, style]} />;
}

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

export function Button({
  title,
  icon,
  variant = "default",
  size = "md",
  loading,
  disabled,
  style,
  ...p
}: Omit<PressableProps, "style"> & { title?: string; icon?: IconName; variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean; style?: StyleProp<ViewStyle> }) {
  const fg = variant === "default" ? colors.primaryForeground : variant === "destructive" ? "#fff" : colors.foreground;
  const h = size === "sm" ? 36 : size === "lg" ? 52 : 46;
  return (
    <Pressable
      {...p}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { height: h, paddingHorizontal: title ? (size === "sm" ? 14 : 20) : 0, width: title ? undefined : h },
        variant === "default" && { backgroundColor: colors.primary },
        variant === "destructive" && { backgroundColor: colors.destructive },
        variant === "secondary" && { backgroundColor: colors.muted },
        variant === "outline" && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.input },
        pressed && { opacity: 0.75 },
        (disabled || loading) && { opacity: 0.45 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={size === "sm" ? 16 : 19} color={fg} /> : null}
      {title ? <Text style={{ color: fg, fontSize: size === "sm" ? 13 : 15, fontWeight: "600" }}>{title}</Text> : null}
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, color = colors.foreground }: { icon: IconName; onPress: () => void; label: string; color?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.iconBtn, pressed && { backgroundColor: colors.accent }]}>
      <Ionicons name={icon} size={22} color={color} />
    </Pressable>
  );
}

export function Chip({ label, active, onPress, count }: { label: string; active?: boolean; onPress?: () => void; count?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active ? { backgroundColor: colors.primary, borderColor: colors.primary } : null]}
    >
      <Text style={{ fontSize: 14, color: active ? colors.primaryForeground : colors.foreground }}>
        {label}
        {count !== undefined ? <Text style={{ opacity: 0.55 }}>{`  ${count}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

export const Field = forwardRef<TextInput, TextInputProps & { multiline?: boolean }>(function Field({ style, multiline, ...p }, ref) {
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors.mutedForeground}
      multiline={multiline}
      textAlignVertical={multiline ? "top" : "center"}
      {...p}
      style={[styles.input, multiline && { minHeight: 96, paddingTop: 10 }, style]}
    />
  );
});

export function Badge({ label, tone = "default" }: { label: string; tone?: "default" | "ai" | "success" | "outline" }) {
  const bg = tone === "ai" ? "#EEEAF8" : tone === "success" ? "#E6F2EC" : tone === "outline" ? "transparent" : colors.muted;
  const fg = tone === "ai" ? colors.ai : tone === "success" ? colors.success : colors.foreground;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, tone === "outline" && { borderWidth: 1, borderColor: colors.border }]}>
      <Text style={{ fontSize: 12, color: fg, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

export function Banner({ tone, children, icon }: { tone: "error" | "warning" | "success" | "info"; children: React.ReactNode; icon?: IconName }) {
  const palette = {
    error: { bg: "#FBEDEB", border: "#F0C9C4", fg: colors.destructive, icon: "alert-circle-outline" as IconName },
    warning: { bg: "#FBF3E6", border: "#EFDDBB", fg: colors.foreground, icon: "warning-outline" as IconName },
    success: { bg: "#EAF4EE", border: "#C4E0CF", fg: colors.foreground, icon: "checkmark-circle-outline" as IconName },
    info: { bg: colors.muted, border: colors.border, fg: colors.foreground, icon: "information-circle-outline" as IconName },
  }[tone];
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Ionicons name={icon ?? palette.icon} size={18} color={tone === "error" ? colors.destructive : tone === "warning" ? colors.warning : tone === "success" ? colors.success : colors.mutedForeground} />
      <View style={{ flex: 1 }}>{typeof children === "string" ? <Text style={{ color: palette.fg, fontSize: 14, lineHeight: 20 }}>{children}</Text> : children}</View>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityState={{ selected: value === o.value }} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: value === o.value ? "600" : "400", color: value === o.value ? colors.foreground : colors.mutedForeground }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Card({ style, ...p }: React.ComponentProps<typeof View>) {
  return <View {...p} style={[{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border }, style]} />;
}

const styles = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.full },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, justifyContent: "center" },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.input, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: 14, fontSize: 16, color: colors.foreground },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, alignSelf: "flex-start" },
  banner: { flexDirection: "row", gap: 10, padding: 12, borderRadius: radius.md, borderWidth: 1, alignItems: "flex-start" },
  segmented: { flexDirection: "row", backgroundColor: colors.muted, borderRadius: radius.full, padding: 3, gap: 3 },
  segment: { flex: 1, height: 36, borderRadius: radius.full, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  segmentActive: { backgroundColor: colors.card, elevation: 1 },
});
