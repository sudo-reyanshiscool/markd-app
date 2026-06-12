import React from "react";
import { StyleProp, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "@/providers/theme";

export type DoodleKind = "zap" | "star" | "squiggle" | "burst" | "arrow";

const PATHS: Record<DoodleKind, string> = {
  // Lightning bolt
  zap: "M13 2 L4 14 L10 14 L8 22 L18 9 L11.5 9 Z",
  // Hand-drawn four-point star
  star: "M12 1 C12.8 6 13.5 7.5 18 8.6 C13.5 10 12.8 11.4 12 17 C11.2 11.4 10.4 10 6 8.6 C10.4 7.5 11.2 6 12 1 Z",
  // Marker squiggle
  squiggle:
    "M2 14 C5 6, 8 6, 11 12 C14 18, 17 18, 20 10 C21.5 6.5, 22.5 6, 23 7",
  // Comic burst
  burst:
    "M12 2 L13.8 8.2 L20 6 L15.6 11 L22 12.6 L15.6 14 L19 19.5 L13.4 16.4 L12 22 L10.6 16.4 L5 19.5 L8.4 14 L2 12.6 L8.4 11 L4 6 L10.2 8.2 Z",
  // Hand arrow
  arrow: "M3 18 C8 16, 14 11, 19 5 M19 5 L13.5 6.5 M19 5 L17.8 10.5",
};

export interface DoodleProps {
  kind: DoodleKind;
  size?: number;
  color?: string;
  rotate?: number;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Marker-style decorative doodles for empty states + celebrations. */
export function Doodle({
  kind,
  size = 28,
  color,
  rotate = 0,
  filled,
  style,
}: DoodleProps) {
  const theme = useTheme();
  const stroke = color ?? theme.ink;
  const isLine = kind === "squiggle" || kind === "arrow";
  const fill = filled === false || isLine ? "none" : (color ?? theme.volt);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={[
        { pointerEvents: "none" },
        rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        style,
      ]}
    >
      <Path
        d={PATHS[kind]}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
