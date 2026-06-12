import React from "react";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui";
import { OnboardingFrame } from "@/features/onboarding/Frame";
import { useOnboardingStore } from "@/stores/onboarding";

export default function StepCountry() {
  const { t } = useTranslation();
  const router = useRouter();
  const country = useOnboardingStore((s) => s.country);
  const set = useOnboardingStore((s) => s.set);

  return (
    <OnboardingFrame
      step={3}
      title={t("onboarding.countryTitle")}
      sub={t("onboarding.countrySub")}
      onNext={() => router.push("/onboarding/track")}
    >
      <Input
        value={country}
        onChangeText={(v) => set({ country: v })}
        placeholder={t("onboarding.countryPlaceholder")}
        autoCapitalize="words"
        maxLength={80}
        testID="onboarding-country"
      />
    </OnboardingFrame>
  );
}
