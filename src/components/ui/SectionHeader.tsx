import React from "react";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";

import { space } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

import { Text } from "./Text";

export interface SectionHeaderProps {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: SectionHeaderProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginTop: space.xxl,
          marginBottom: space.md,
        },
        style,
      ]}
    >
      <Text variant="label" muted>
        {title}
      </Text>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={action}
          hitSlop={8}
        >
          {({ hovered }) => (
            <Text
              variant="label"
              color={theme.ink}
              style={hovered ? { textDecorationLine: "underline" } : undefined}
            >
              {action} →
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
