import { Platform } from "react-native";

/** Warm, photography-first palette (same as the web app). */
export const colors = {
  background: "#FAF9F7",
  foreground: "#2A2724",
  card: "#FFFFFF",
  muted: "#F1EFEB",
  mutedForeground: "#7A746D",
  accent: "#ECE8E2",
  border: "#E7E3DD",
  input: "#DDD8D1",
  primary: "#2A2724",
  primaryForeground: "#FAF9F7",
  destructive: "#C9372C",
  success: "#2E7D55",
  warning: "#B7791F",
  ai: "#6E5BB8",
  overlay: "rgba(0,0,0,0.4)",
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };
export const space = (n: number) => n * 4;

export const fonts = {
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
};
