import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/providers/theme";

import { Slab } from "./Slab";

export interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  label: string; // accessibility label, required
  size?: number;
  color?: string;
  iconColor?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 42,
  color,
  iconColor,
  disabled,
  style,
  testID,
}: IconButtonProps) {
  const theme = useTheme();
  return (
    <Slab
      color={color ?? theme.surface}
      onPress={onPress}
      disabled={disabled}
      offset={3}
      radius={12}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={style}
      contentStyle={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
      testID={testID}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.48)}
        color={iconColor ?? theme.ink}
      />
    </Slab>
  );
}
