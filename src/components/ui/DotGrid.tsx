import React from "react";
import { StyleSheet } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { useTheme } from "@/providers/theme";

/**
 * Faint dot-grid texture behind screens — graph-paper energy.
 * Absolutely positioned; render once per Screen.
 */
export function DotGrid({ opacity = 0.35 }: { opacity?: number }) {
  const theme = useTheme();
  return (
    <Svg
      style={[StyleSheet.absoluteFill, { opacity, pointerEvents: "none" }]}
      width="100%"
      height="100%"
    >
      <Defs>
        <Pattern
          id="markd-dots"
          x="0"
          y="0"
          width="22"
          height="22"
          patternUnits="userSpaceOnUse"
        >
          <Circle cx="2" cy="2" r="1.1" fill={theme.inkFaint} opacity={0.4} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#markd-dots)" />
    </Svg>
  );
}
