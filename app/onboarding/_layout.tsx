import React from "react";
import { Stack } from "expo-router";

import { useTheme } from "@/providers/theme";

export default function OnboardingLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
        animation: "slide_from_right",
      }}
    />
  );
}
