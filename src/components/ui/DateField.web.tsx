import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { edge, fonts, radius } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Text } from "./Text";

export interface DateFieldProps {
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  clearable?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Web build: a styled native <input type="date">. */
export function DateField({
  value,
  onChange,
  label,
  error,
  containerStyle,
}: DateFieldProps) {
  const theme = useTheme();
  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" muted style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      {React.createElement("input", {
        type: "date",
        value: value ?? "",
        onChange: (e: { target: { value: string } }) =>
          onChange(e.target.value ? e.target.value : null),
        "aria-label": label ?? "Date",
        style: {
          backgroundColor: theme.well,
          border: `${edge.borderWidth}px solid ${error ? theme.danger : theme.border}`,
          borderRadius: radius.input,
          height: 50,
          padding: "0 14px",
          fontFamily: "AzeretMono_700Bold, monospace",
          fontSize: 14,
          color: theme.ink,
          colorScheme: theme.name,
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
        },
      })}
      {error ? (
        <Text variant="caption" color={theme.danger} style={{ marginTop: 5 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
