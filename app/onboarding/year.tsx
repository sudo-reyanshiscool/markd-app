import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Chip } from "@/components/ui";
import { YEAR_GROUPS } from "@/constants/tracks";
import { OnboardingFrame } from "@/features/onboarding/Frame";
import { useOnboardingStore } from "@/stores/onboarding";

export default function StepYear() {
  const { t } = useTranslation();
  const router = useRouter();
  const track = useOnboardingStore((s) => s.track);
  const yearGroup = useOnboardingStore((s) => s.yearGroup);
  const set = useOnboardingStore((s) => s.set);

  const options = YEAR_GROUPS[track ?? "other"];

  return (
    <OnboardingFrame
      step={5}
      title={t("onboarding.yearTitle")}
      nextDisabled={!yearGroup}
      onNext={() => router.push("/onboarding/subject")}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {options.map((year) => (
          <Chip
            key={year}
            label={year}
            active={yearGroup === year}
            onPress={() => set({ yearGroup: year })}
            testID={`year-${year.replaceAll(" ", "-")}`}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}
