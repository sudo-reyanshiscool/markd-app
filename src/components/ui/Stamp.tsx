import React from "react";
import { StyleProp, ViewStyle } from "react-native";

import { fonts } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Slab } from "./Slab";
import { Text } from "./Text";

export interface StampProps {
  label: string;
  /** Fill color. Defaults to volt. */
  color?: string;
  textColor?: string;
  rotate?: number;
  size?: "md" | "sm";
  style?: StyleProp<ViewStyle>;
}

/** Tilted sticker label — "DO NEXT", "PRO", target grades, badges. */
export function Stamp({
  label,
  color,
  textColor,
  rotate = -3,
  size = "md",
  style,
}: StampProps) {
  const theme = useTheme();
  return (
    <Slab
      color={color ?? theme.volt}
      rotate={rotate}
      offset={2}
      radius={6}
      borderWidth={1.5}
      style={style}
      contentStyle={{
        paddingHorizontal: size === "md" ? 9 : 7,
        paddingVertical: size === "md" ? 4 : 2.5,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size === "md" ? 10.5 : 9,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: textColor ?? theme.onVolt,
        }}
      >
        {label}
      </Text>
    </Slab>
  );
}
