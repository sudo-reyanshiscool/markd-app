import React from "react";
import {
  AccessibilityRole,
  Pressable,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { edge, radius as radii } from "@/constants/theme";
import { tap } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";

const SPRING = { damping: 22, stiffness: 420, mass: 0.6 };

export interface SlabProps {
  children?: React.ReactNode;
  /** Surface fill. Defaults to theme.surface. */
  color?: string;
  /** Border color. Defaults to theme.border. */
  borderColor?: string;
  borderWidth?: number;
  /** Hard offset shadow. */
  shadow?: boolean;
  /** Shadow offset px (down-right). */
  offset?: number;
  radius?: number;
  /** Sticker tilt in degrees. */
  rotate?: number;
  /** Outer wrapper style — margins, flex, width. */
  style?: StyleProp<ViewStyle>;
  /** Inner surface style — padding, alignment. */
  contentStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  haptic?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityHint?: string;
  testID?: string;
}

/**
 * The signature INK & VOLT surface: a bordered sticker sitting on a hard
 * offset shadow. Pressing slides the sticker onto its shadow — a physical
 * "click". Used by cards, buttons, chips, the tab dock, everything.
 */
export function Slab({
  children,
  color,
  borderColor,
  borderWidth = edge.borderWidth,
  shadow = true,
  offset = edge.shadowOffset,
  radius = radii.card,
  rotate = 0,
  style,
  contentStyle,
  onPress,
  onLongPress,
  disabled = false,
  haptic = true,
  accessibilityLabel,
  accessibilityRole,
  accessibilityHint,
  testID,
}: SlabProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const shadowOffset = shadow ? offset : 0;

  const animatedSurface = useAnimatedStyle(() => ({
    transform: [
      { translateX: pressed.value * shadowOffset },
      { translateY: pressed.value * shadowOffset },
    ],
    opacity: disabled ? 0.55 : 1,
  }));

  const surfaceStyle: ViewStyle = {
    backgroundColor: color ?? theme.surface,
    borderColor: borderColor ?? theme.border,
    borderWidth,
    borderRadius: radius,
  };

  const inner = (
    <Animated.View style={[animatedSurface, surfaceStyle, contentStyle]}>
      {children}
    </Animated.View>
  );

  const body = (
    <View
      style={[
        rotate !== 0 ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        { paddingRight: shadowOffset, paddingBottom: shadowOffset },
        style,
      ]}
      testID={testID}
    >
      {shadow ? (
        <View
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: shadowOffset,
            left: shadowOffset,
            right: 0,
            bottom: 0,
            backgroundColor: theme.shadow,
            borderRadius: radius,
          }}
        />
      ) : null}
      {inner}
    </View>
  );

  if (!onPress && !onLongPress) return body;

  return (
    <Pressable
      onPress={() => {
        if (haptic) tap();
        onPress?.();
      }}
      onLongPress={onLongPress}
      onPressIn={() => {
        if (!reducedMotion) pressed.value = withSpring(1, SPRING);
      }}
      onPressOut={() => {
        if (!reducedMotion) pressed.value = withSpring(0, SPRING);
      }}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? "button"}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ hovered }) => [
        rotate !== 0 ? { transform: [{ rotate: `${rotate}deg` }] } : null,
        { paddingRight: shadowOffset, paddingBottom: shadowOffset },
        hovered && !disabled ? { opacity: 0.96 } : null,
        style,
      ]}
    >
      {shadow ? (
        <View
          style={{
            pointerEvents: "none",
            position: "absolute",
            top: shadowOffset,
            left: shadowOffset,
            right: 0,
            bottom: 0,
            backgroundColor: theme.shadow,
            borderRadius: radius,
          }}
        />
      ) : null}
      {inner}
    </Pressable>
  );
}
