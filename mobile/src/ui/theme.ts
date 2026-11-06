import { createContext, createElement, useContext, useMemo } from "react";
import { Platform, useColorScheme } from "react-native";

/** Warm, photography-first palettes (light matches the web app). */
export interface Palette {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  success: string;
  warning: string;
  ai: string;
  overlay: string;
  /** Soft tinted backgrounds/borders for banners, badges and marks. */
  errorBg: string;
  errorBorder: string;
  warningBg: string;
  warningBorder: string;
  successBg: string;
  successBorder: string;
  aiBg: string;
  /** Slightly softer body text (descriptions). */
  softForeground: string;
  /** Scrim behind icons laid over photos. */
  photoScrim: string;
}

export const lightColors: Palette = {
  background: "#FAF9F7",
  foreground: "#2A2724",
  card: "#FFFFFF",
  muted: "#F1EFEB",
  mutedForeground: "#6B655E",
  accent: "#ECE8E2",
  border: "#E7E3DD",
  input: "#DDD8D1",
  primary: "#2A2724",
  primaryForeground: "#FAF9F7",
  destructive: "#C9372C",
  success: "#2E7D55",
  warning: "#96610F",
  ai: "#6E5BB8",
  overlay: "rgba(0,0,0,0.4)",
  errorBg: "#FBEDEB",
  errorBorder: "#F0C9C4",
  warningBg: "#FBF3E6",
  warningBorder: "#EFDDBB",
  successBg: "#EAF4EE",
  successBorder: "#C4E0CF",
  aiBg: "#EEEAF8",
  softForeground: "#4A4541",
  photoScrim: "rgba(0,0,0,0.15)",
};

export const darkColors: Palette = {
  background: "#161412",
  foreground: "#F2EFEA",
  card: "#1F1C1A",
  muted: "#2A2623",
  mutedForeground: "#A39C94",
  accent: "#312D29",
  border: "#34302C",
  input: "#433E39",
  primary: "#F2EFEA",
  primaryForeground: "#1C1A18",
  destructive: "#EF6A5E",
  success: "#5DBB8A",
  warning: "#E0A84A",
  ai: "#AE9FEA",
  overlay: "rgba(0,0,0,0.6)",
  errorBg: "#3A201D",
  errorBorder: "#5C2F2A",
  warningBg: "#352A18",
  warningBorder: "#54421F",
  successBg: "#1B2E24",
  successBorder: "#2B4A39",
  aiBg: "#2A2540",
  softForeground: "#D6D1CA",
  photoScrim: "rgba(0,0,0,0.3)",
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 };

export const fonts = {
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
};

export type ThemePreference = "system" | "light" | "dark";

interface Theme {
  colors: Palette;
  dark: boolean;
}

const ThemeContext = createContext<Theme>({ colors: lightColors, dark: false });

/** Provides the palette: follows the phone's setting unless the user picked light or dark. */
export function ThemeProvider({ preference = "system", children }: { preference?: ThemePreference; children: React.ReactNode }) {
  const system = useColorScheme();
  const dark = preference === "dark" || (preference === "system" && system === "dark");
  const value = useMemo(() => ({ colors: dark ? darkColors : lightColors, dark }), [dark]);
  return createElement(ThemeContext.Provider, { value }, children);
}

export const useTheme = () => useContext(ThemeContext);
export const useColors = () => useContext(ThemeContext).colors;

const styleCache = new WeakMap<object, WeakMap<Palette, unknown>>();

/** Memoized per-palette styles: `const styles = useStyles(makeStyles)`. */
export function useStyles<T>(factory: (c: Palette) => T): T {
  const colors = useColors();
  let byPalette = styleCache.get(factory) as WeakMap<Palette, T> | undefined;
  if (!byPalette) {
    byPalette = new WeakMap();
    styleCache.set(factory, byPalette as WeakMap<Palette, unknown>);
  }
  let styles = byPalette.get(colors);
  if (!styles) {
    styles = factory(colors);
    byPalette.set(colors, styles);
  }
  return styles;
}
