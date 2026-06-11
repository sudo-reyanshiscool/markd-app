import React, { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { tap } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";

const W = 56;
const H = 32;
const KNOB = 22;

export interface ToggleProps {
  value: boolean;
  onChange: (next: boolean) => void;
  label: string; // accessibility label, required
  disabled?: boolean;
  testID?: string;
}

export function Toggle({ value, onChange, label, disabled, testID }: ToggleProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.value = reducedMotion
      ? value
        ? 1
        : 0
      : withSpring(value ? 1 : 0, { damping: 20, stiffness: 320 });
  }, [value, on, reducedMotion]);

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: on.value * (W - KNOB - 10) }],
  }));

  return (
    <Pressable
      onPress={() => {
        tap();
        onChange(!value);
      }}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={6}
      testID={testID}
      style={{
        width: W,
        height: H,
        borderRadius: H / 2,
        borderWidth: 2,
        borderColor: theme.border,
        backgroundColor: value ? theme.volt : theme.well,
        justifyContent: "center",
        paddingHorizontal: 3,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Animated.View
        style={[
          knobStyle,
          {
            width: KNOB,
            height: KNOB,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: theme.surface,
          },
        ]}
      />
    </Pressable>
  );
}
