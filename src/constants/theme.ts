/**
 * INK & VOLT — Markd's design language.
 *
 * Warm-paper brutalism: chunky borders, hard offset shadows, sticker-like
 * surfaces, one electric accent ("volt") that carries all energy moments
 * (streaks, XP, the Do-Next card, the focus timer).
 *
 * Light ("Paper") and dark ("Asphalt") are designed as siblings, not
 * inversions: Paper is warm cream + ink; Asphalt is coal + bone with volt
 * turned up slightly brighter so it glows instead of shouts.
 */

export type ThemeName = "light" | "dark";

export interface Theme {
  name: ThemeName;
  /** App background */
  bg: string;
  /** Raised surfaces: cards, sheets, tab dock */
  surface: string;
  /** Sunken surfaces: inputs, wells, progress tracks */
  well: string;
  /** Primary text + borders + hard shadows */
  ink: string;
  /** Secondary text */
  inkMuted: string;
  /** Tertiary text / placeholders */
  inkFaint: string;
  /** Border color (same family as ink, may soften in dark) */
  border: string;
  /** The volt accent */
  volt: string;
  /** Text/icon color drawn on top of volt */
  onVolt: string;
  /** Hard offset shadow color */
  shadow: string;
  danger: string;
  onDanger: string;
  warn: string;
  success: string;
  /** Dimmed overlay behind modals/sheets */
  scrim: string;
}

export const lightTheme: Theme = {
  name: "light",
  bg: "#F6F2E9",
  surface: "#FFFDF7",
  well: "#ECE6D8",
  ink: "#16140F",
  inkMuted: "#5C574A",
  inkFaint: "#98927F",
  border: "#16140F",
  volt: "#C8FF1F",
  onVolt: "#16140F",
  shadow: "#16140F",
  danger: "#E5484D",
  onDanger: "#FFFDF7",
  warn: "#E8960C",
  success: "#2FA866",
  scrim: "rgba(22, 20, 15, 0.55)",
};

export const darkTheme: Theme = {
  name: "dark",
  bg: "#12110D",
  surface: "#1D1B15",
  well: "#0B0A07",
  ink: "#F4F0E6",
  inkMuted: "#A8A290",
  inkFaint: "#6E6857",
  border: "#F4F0E6",
  volt: "#D6FF4B",
  onVolt: "#16140F",
  shadow: "#000000",
  danger: "#FF6369",
  onDanger: "#16140F",
  warn: "#FFB224",
  success: "#3DD68C",
  scrim: "rgba(0, 0, 0, 0.65)",
};

export const themes: Record<ThemeName, Theme> = {
  light: lightTheme,
  dark: darkTheme,
};

/**
 * Subject swatches. Bright enough to pop on Paper and Asphalt alike;
 * `onColor` is always ink for legibility.
 */
export const SUBJECT_COLORS = [
  { key: "volt", hex: "#C8FF1F" },
  { key: "bubblegum", hex: "#FF7AC3" },
  { key: "tangerine", hex: "#FF9A3D" },
  { key: "sky", hex: "#6FC2FF" },
  { key: "lilac", hex: "#C0A8FF" },
  { key: "mint", hex: "#54E6A9" },
  { key: "lemon", hex: "#FFD43B" },
  { key: "coral", hex: "#FF7A6B" },
] as const;

export type SubjectColorKey = (typeof SUBJECT_COLORS)[number]["key"];

export function subjectHex(key: string | null | undefined): string {
  const found = SUBJECT_COLORS.find((c) => c.key === key);
  return found ? found.hex : SUBJECT_COLORS[0].hex;
}

/** Spacing scale (px). Use these over magic numbers. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  jumbo: 40,
} as const;

/** Corner radii. */
export const radius = {
  card: 20,
  btn: 14,
  chip: 999,
  sheet: 28,
  input: 14,
} as const;

/** Border + hard shadow geometry. */
export const edge = {
  borderWidth: 2,
  borderThin: 1.5,
  shadowOffset: 4,
  shadowOffsetSm: 3,
} as const;

/** Font family names as registered by expo-google-fonts. */
export const fonts = {
  display: "Unbounded_700Bold",
  displayHeavy: "Unbounded_800ExtraBold",
  displayBlack: "Unbounded_900Black",
  body: "BricolageGrotesque_400Regular",
  bodyMedium: "BricolageGrotesque_500Medium",
  bodySemi: "BricolageGrotesque_600SemiBold",
  bodyBold: "BricolageGrotesque_700Bold",
  mono: "AzeretMono_500Medium",
  monoBold: "AzeretMono_700Bold",
} as const;
