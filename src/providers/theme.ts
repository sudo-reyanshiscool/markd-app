import { useColorScheme } from "react-native";

import { Theme, ThemeName, themes } from "@/constants/theme";
import { ThemePreference, useThemeStore } from "@/stores/theme";

/** Resolved theme for the current preference + OS scheme. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = useThemeStore((s) => s.preference);
  const name: ThemeName =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;
  return themes[name];
}

export function useThemeControls(): {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
} {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return { preference, setPreference };
}
