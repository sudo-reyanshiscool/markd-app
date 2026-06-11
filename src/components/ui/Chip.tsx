import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { fonts, radius } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Slab } from "./Slab";
import { Text } from "./Text";

export interface ChipProps {
  label: string;
  onPress?: () => void;
  active?: boolean;
  /** Custom fill when active (e.g. subject color). Defaults to volt. */
  activeColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: "md" | "sm";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Chip({
  label,
  onPress,
  active = false,
  activeColor,
  icon,
  size = "md",
  style,
  accessibilityLabel,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const fill = active ? (activeColor ?? theme.volt) : theme.surface;

  return (
    <Slab
      color={fill}
      shadow={active}
      offset={2}
      radius={radius.chip}
      borderWidth={1.5}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole={onPress ? "button" : undefined}
      style={style}
      contentStyle={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: size === "md" ? 13 : 10,
        height: size === "md" ? 34 : 28,
      }}
      testID={testID}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={size === "md" ? 13 : 11}
          color={active ? theme.onVolt : theme.inkMuted}
        />
      ) : null}
      <Text
        style={{
          fontFamily: fonts.bodyBold,
          fontSize: size === "md" ? 12.5 : 11,
          letterSpacing: 0.4,
          color: active ? theme.onVolt : theme.ink,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Slab>
  );
}
