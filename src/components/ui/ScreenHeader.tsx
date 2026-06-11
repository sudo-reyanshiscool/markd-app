import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { useRouter } from "expo-router";

import { space } from "@/constants/theme";

import { IconButton } from "./IconButton";
import { Text } from "./Text";

export interface ScreenHeaderProps {
  title: string;
  eyebrow?: string;
  back?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function ScreenHeader({ title, eyebrow, back = true, right, style }: ScreenHeaderProps) {
  const router = useRouter();
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          marginBottom: space.lg,
        },
        style,
      ]}
    >
      {back ? (
        <IconButton
          icon="arrow-back"
          label="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        {eyebrow ? (
          <Text variant="label" muted>
            {eyebrow}
          </Text>
        ) : null}
        <Text variant="display" numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
