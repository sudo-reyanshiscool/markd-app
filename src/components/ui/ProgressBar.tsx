import React, { useEffect } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { radius } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  height?: number;
  /** Fill color. Defaults to volt. */
  color?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function ProgressBar({
  value,
  height = 14,
  color,
  style,
  accessibilityLabel,
}: ProgressBarProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, value));

  useEffect(() => {
    progress.value = reducedMotion
      ? clamped
      : withSpring(clamped, { damping: 24, stiffness: 160 });
  }, [clamped, progress, reducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          height,
          backgroundColor: theme.well,
          borderRadius: radius.chip,
          borderWidth: 1.5,
          borderColor: theme.border,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={[
          fillStyle,
          {
            height: "100%",
            backgroundColor: color ?? theme.volt,
            borderTopRightRadius: radius.chip,
            borderBottomRightRadius: radius.chip,
          },
        ]}
      />
    </View>
  );
}
