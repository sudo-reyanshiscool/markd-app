import React from "react";
import { ActivityIndicator, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fonts, radius } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Slab } from "./Slab";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "lg" | "md" | "sm";

const HEIGHTS: Record<Size, number> = { lg: 54, md: 46, sm: 38 };
const PADDINGS: Record<Size, number> = { lg: 22, md: 18, sm: 14 };
const FONT_SIZES: Record<Size, number> = { lg: 15, md: 14, sm: 12.5 };

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to fill its row. */
  block?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  loading = false,
  disabled = false,
  block = false,
  style,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const theme = useTheme();

  const palette = {
    primary: { bg: theme.volt, fg: theme.onVolt, border: theme.border },
    secondary: { bg: theme.surface, fg: theme.ink, border: theme.border },
    danger: { bg: theme.danger, fg: theme.onDanger, border: theme.border },
    ghost: { bg: "transparent", fg: theme.ink, border: "transparent" },
  }[variant];

  const isGhost = variant === "ghost";
  const height = HEIGHTS[size];

  return (
    <Slab
      color={palette.bg}
      borderColor={palette.border}
      shadow={!isGhost}
      offset={size === "sm" ? 3 : 4}
      radius={radius.btn}
      onPress={loading || disabled ? undefined : onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      style={[block ? { alignSelf: "stretch" } : { alignSelf: "flex-start" }, style]}
      contentStyle={{
        height,
        paddingHorizontal: PADDINGS[size],
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <>
          {icon ? (
            <Ionicons name={icon} size={FONT_SIZES[size] + 3} color={palette.fg} />
          ) : null}
          <Text
            style={{
              fontFamily: fonts.bodyBold,
              fontSize: FONT_SIZES[size],
              letterSpacing: 0.8,
              textTransform: "uppercase",
              color: palette.fg,
            }}
          >
            {label}
          </Text>
          {iconRight ? (
            <Ionicons
              name={iconRight}
              size={FONT_SIZES[size] + 3}
              color={palette.fg}
            />
          ) : null}
        </>
      )}
    </Slab>
  );
}
