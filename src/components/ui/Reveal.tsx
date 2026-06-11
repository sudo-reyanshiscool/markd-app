import React, { useEffect } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

export interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  from?: "bottom" | "top" | "scale" | "fade";
  distance?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance animation built on shared values (works identically on iOS,
 * Android and web — unlike the prefab entering animations). Respects the
 * OS reduced-motion preference by snapping straight to the final state.
 */
export function Reveal({
  children,
  delay = 0,
  from = "bottom",
  distance = 16,
  style,
}: RevealProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withSpring(1, { damping: 21, stiffness: 230, mass: 0.7 }),
    );
  }, [delay, progress, reducedMotion]);

  const animated = useAnimatedStyle(() => {
    const p = progress.value;
    const transform =
      from === "bottom"
        ? [{ translateY: (1 - p) * distance }]
        : from === "top"
          ? [{ translateY: (p - 1) * distance }]
          : from === "scale"
            ? [{ scale: 0.9 + p * 0.1 }]
            : [];
    return { opacity: p, transform };
  });

  return <Animated.View style={[animated, style]}>{children}</Animated.View>;
}
