import React, { useState } from "react";
import { View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { Doodle, Reveal, Screen, Slab, Stamp, Text, Button } from "@/components/ui";
import { STARTER_TASKS } from "@/constants/tracks";
import { completeOnboarding } from "@/features/onboarding/finish";
import { cheer } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";
import { useOnboardingStore } from "@/stores/onboarding";

export default function StepFinish() {
  const { t } = useTranslation();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const draft = useOnboardingStore();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      await completeOnboarding();
      cheer();
      await queryClient.invalidateQueries();
      // The root gate flips to (tabs) once guestOnboarded/onboarded_at lands.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 22 }}>
        <Reveal delay={40} style={{ flexDirection: "row", gap: 10 }}>
          <Doodle kind="burst" size={42} rotate={-8} />
          <Doodle kind="zap" size={30} rotate={14} style={{ marginTop: 18 }} />
        </Reveal>
        <Reveal delay={120}>
          <Text variant="displayXL" style={{ fontSize: 38, lineHeight: 46 }}>
            {t("onboarding.finishTitle")}
          </Text>
          <Text variant="body" muted style={{ marginTop: 10, maxWidth: 420 }}>
            {t("onboarding.finishSub")}
          </Text>
        </Reveal>

        <Reveal delay={220}>
          <Slab
            rotate={-1.5}
            contentStyle={{ padding: 18, gap: 12 }}
            style={{ alignSelf: "stretch" }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Stamp label={draft.subjectName.trim().toUpperCase() || "SUBJECT"} rotate={-3} />
              {draft.yearGroup ? (
                <Stamp
                  label={draft.yearGroup.toUpperCase()}
                  color={theme.surface}
                  textColor={theme.ink}
                  rotate={2}
                />
              ) : null}
            </View>
            {STARTER_TASKS.map((task) => (
              <View
                key={task.text}
                style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
              >
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: theme.border,
                    backgroundColor: theme.well,
                  }}
                />
                <Text variant="bodyMedium" style={{ flex: 1 }}>
                  {task.text}
                </Text>
              </View>
            ))}
          </Slab>
        </Reveal>

        <Reveal delay={320}>
          <Button
            label={t("onboarding.finishCta")}
            size="lg"
            block
            loading={busy}
            onPress={go}
            testID="onboarding-finish"
          />
        </Reveal>
      </View>
    </Screen>
  );
}
