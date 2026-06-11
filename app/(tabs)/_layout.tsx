import React from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";

import { TabDock } from "@/components/TabDock";
import { useTheme } from "@/providers/theme";

export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Tabs
      tabBar={(props) => <TabDock {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabs.home") }} />
      <Tabs.Screen name="tasks" options={{ title: t("tabs.tasks") }} />
      <Tabs.Screen name="timeline" options={{ title: t("tabs.timeline") }} />
      <Tabs.Screen name="subjects" options={{ title: t("tabs.subjects") }} />
      <Tabs.Screen name="more" options={{ title: t("tabs.more") }} />
    </Tabs>
  );
}
