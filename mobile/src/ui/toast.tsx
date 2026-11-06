import { Ionicons } from "@expo/vector-icons";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, type Palette, useColors, useStyles } from "./theme";

type Kind = "success" | "error" | "info";
const Ctx = createContext<(message: string, kind?: Kind) => void>(() => undefined);

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const show = useCallback((message: string, kind: Kind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, kind });
    timer.current = setTimeout(() => setToast(null), kind === "error" ? 6000 : 2800);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 84 }]}>
          <View style={[styles.toast, toast.kind === "error" && { backgroundColor: colors.destructive }]}>
            <Ionicons name={toast.kind === "error" ? "alert-circle" : toast.kind === "info" ? "information-circle" : "checkmark-circle"} size={18} color={toast.kind === "error" ? "#fff" : colors.primaryForeground} />
            <Text style={[styles.text, { color: toast.kind === "error" ? "#fff" : colors.primaryForeground }]}>{toast.message}</Text>
          </View>
        </View>
      )}
    </Ctx.Provider>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center" },
  toast: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.lg, maxWidth: 480 },
  text: { fontSize: 14, flexShrink: 1 },
});
