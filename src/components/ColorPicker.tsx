import React from "react";
import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SUBJECT_COLORS } from "@/constants/theme";
import { tap } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";

/** Subject colour swatch row. */
export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {SUBJECT_COLORS.map((swatch) => {
        const selected = value === swatch.key;
        return (
          <Pressable
            key={swatch.key}
            onPress={() => {
              tap();
              onChange(swatch.key);
            }}
            accessibilityRole="radio"
            accessibilityLabel={swatch.key}
            accessibilityState={{ selected }}
            testID={`color-${swatch.key}`}
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: swatch.hex,
              borderWidth: 2,
              borderColor: theme.border,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ rotate: selected ? "-6deg" : "0deg" }, { scale: selected ? 1.08 : 1 }],
            }}
          >
            {selected ? <Ionicons name="checkmark" size={20} color="#16140F" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
