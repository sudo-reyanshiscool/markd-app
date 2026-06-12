import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Slab, Stamp, Text } from "@/components/ui";
import { TRACKS } from "@/constants/tracks";
import { OnboardingFrame } from "@/features/onboarding/Frame";
import { useTheme } from "@/providers/theme";
import { useOnboardingStore } from "@/stores/onboarding";

const TILTS = [-2, 1.5, -1, 2, -1.5];

export default function StepTrack() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const track = useOnboardingStore((s) => s.track);
  const set = useOnboardingStore((s) => s.set);

  return (
    <OnboardingFrame
      step={4}
      title={t("onboarding.trackTitle")}
      sub={t("onboarding.trackSub")}
      nextDisabled={!track}
      onNext={() => router.push("/onboarding/year")}
    >
      <View style={{ gap: 12 }}>
        {TRACKS.map((option, i) => {
          const selected = track === option.value;
          return (
            <Slab
              key={option.value}
              onPress={() => set({ track: option.value, yearGroup: null })}
              color={selected ? theme.volt : theme.surface}
              rotate={TILTS[i] ?? 0}
              radius={16}
              contentStyle={{
                paddingHorizontal: 18,
                height: 58,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              testID={`track-${option.value}`}
            >
              <Text
                variant="title"
                color={selected ? theme.onVolt : theme.ink}
                style={{ textTransform: "uppercase" }}
              >
                {option.label}
              </Text>
              {selected ? <Stamp label="THAT'S ME" rotate={4} color={theme.surface} textColor={theme.ink} /> : null}
            </Slab>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}
