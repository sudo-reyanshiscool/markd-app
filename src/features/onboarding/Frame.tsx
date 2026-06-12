import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Button, IconButton, Reveal, Screen, Text } from "@/components/ui";
import { space } from "@/constants/theme";
import { useTheme } from "@/providers/theme";

export const TOTAL_STEPS = 6;

export function OnboardingFrame({
  step,
  title,
  sub,
  children,
  nextDisabled,
  onNext,
  nextLabel,
  busy,
  hideBack,
}: {
  step: number;
  title: string;
  sub?: string;
  children: React.ReactNode;
  nextDisabled?: boolean;
  onNext: () => void;
  nextLabel?: string;
  busy?: boolean;
  hideBack?: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        {!hideBack && router.canGoBack() ? (
          <IconButton icon="arrow-back" label={t("common.back")} onPress={() => router.back()} />
        ) : null}
        <View style={{ flexDirection: "row", gap: 5, flex: 1 }}>
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 7,
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: theme.border,
                backgroundColor: i < step ? theme.volt : theme.well,
              }}
            />
          ))}
        </View>
        <Text variant="monoSm" muted>
          {t("onboarding.stepOf", { step, total: TOTAL_STEPS })}
        </Text>
      </View>

      <Reveal delay={60} style={{ marginTop: space.xxl }}>
        <Text variant="displayXL">{title}</Text>
        {sub ? (
          <Text variant="body" muted style={{ marginTop: 8 }}>
            {sub}
          </Text>
        ) : null}
      </Reveal>

      <Reveal delay={140} style={{ flex: 1, marginTop: space.xl }}>
        {children}
      </Reveal>

      <Button
        label={nextLabel ?? t("onboarding.next")}
        size="lg"
        block
        disabled={nextDisabled}
        loading={busy}
        onPress={onNext}
        style={{ marginBottom: space.md }}
        testID="onboarding-next"
      />
    </Screen>
  );
}
