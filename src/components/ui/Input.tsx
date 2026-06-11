import React, { useState } from "react";
import {
  StyleProp,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { edge, fonts, radius } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Text } from "./Text";

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  hint,
  containerStyle,
  multiline,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.danger : focused ? theme.volt : theme.border;

  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="label" muted style={{ marginBottom: 6 }}>
          {label}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={theme.inkFaint}
        style={[
          {
            backgroundColor: theme.well,
            borderWidth: edge.borderWidth,
            borderColor,
            borderRadius: radius.input,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 0,
            height: multiline ? undefined : 50,
            minHeight: multiline ? 96 : undefined,
            textAlignVertical: multiline ? "top" : "center",
            fontFamily: fonts.bodyMedium,
            fontSize: 15.5,
            color: theme.ink,
          },
          style,
        ]}
      />
      {error ? (
        <Text variant="caption" color={theme.danger} style={{ marginTop: 5 }}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" faint style={{ marginTop: 5 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
