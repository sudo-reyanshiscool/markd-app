import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Input, Text } from "@/components/ui";
import { ColorPicker } from "@/components/ColorPicker";
import { OnboardingFrame } from "@/features/onboarding/Frame";
import { useOnboardingStore } from "@/stores/onboarding";

export default function StepSubject() {
  const { t } = useTranslation();
  const router = useRouter();
  const subjectName = useOnboardingStore((s) => s.subjectName);
  const subjectColor = useOnboardingStore((s) => s.subjectColor);
  const set = useOnboardingStore((s) => s.set);

  return (
    <OnboardingFrame
      step={6}
      title={t("onboarding.subjectTitle")}
      sub={t("onboarding.subjectSub")}
      nextDisabled={subjectName.trim().length === 0}
      onNext={() => router.push("/onboarding/finish")}
    >
      <View style={{ gap: 20 }}>
        <Input
          value={subjectName}
          onChangeText={(v) => set({ subjectName: v })}
          placeholder={t("onboarding.subjectPlaceholder")}
          autoCapitalize="words"
          maxLength={80}
          testID="onboarding-subject"
        />
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("subjects.colour")}
          </Text>
          <ColorPicker value={subjectColor} onChange={(c) => set({ subjectColor: c })} />
        </View>
      </View>
    </OnboardingFrame>
  );
}
