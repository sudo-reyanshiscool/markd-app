import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/providers/theme";

import { Slab } from "./Slab";

export interface FABProps {
  onPress: () => void;
  label: string; // accessibility label
  icon?: keyof typeof Ionicons.glyphMap;
  /** Lifted above the floating tab dock. */
  aboveDock?: boolean;
}

export function FAB({ onPress, label, icon = "add", aboveDock = true }: FABProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: 18,
        bottom: (aboveDock ? 104 : 24) + insets.bottom,
      }}
    >
      <Slab
        color={theme.volt}
        onPress={onPress}
        radius={18}
        offset={4}
        accessibilityLabel={label}
        accessibilityRole="button"
        rotate={2}
        contentStyle={{
          width: 58,
          height: 58,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={28} color={theme.onVolt} />
      </Slab>
    </View>
  );
}
