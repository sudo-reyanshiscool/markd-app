import React, { useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import {
  Button,
  Doodle,
  Reveal,
  Screen,
  Slab,
  Stamp,
  Text,
  Wordmark,
} from "@/components/ui";
import { loadSampleData } from "@/features/settings/sampleData";
import { localBackend } from "@/lib/backend";
import { cheer, tap } from "@/lib/haptics";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useTheme } from "@/providers/theme";
import { useSessionStore } from "@/stores/session";

/** Logo tap-streak: this many rapid presses hatches the demo. */
const HATCH_TAPS = 5;
const TAP_GAP_MS = 600;

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const enterGuest = useSessionStore((s) => s.enterGuest);
  const setGuestOnboarded = useSessionStore((s) => s.setGuestOnboarded);

  // Easter egg (and demo shortcut): spam-press the wordmark to skip straight
  // into guest mode with the sample dataset loaded.
  const streak = useRef({ count: 0, last: 0 });
  const [hatching, setHatching] = useState(false);
  const logoScale = useSharedValue(1);
  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const onLogoPress = () => {
    const now = Date.now();
    streak.current =
      now - streak.current.last < TAP_GAP_MS
        ? { count: streak.current.count + 1, last: now }
        : { count: 1, last: now };
    tap();
    // pulse harder the closer the streak gets
    const pop = 1.06 + Math.min(streak.current.count, HATCH_TAPS) * 0.02;
    logoScale.value = withSequence(
      withSpring(pop, { damping: 14, stiffness: 500 }),
      withSpring(1, { damping: 16, stiffness: 360 }),
    );

    if (streak.current.count >= HATCH_TAPS && !hatching) {
      setHatching(true);
      streak.current = { count: 0, last: 0 };
      void (async () => {
        try {
          if (!(await localBackend.hasAnyData())) {
            await loadSampleData(localBackend);
          }
          cheer();
          enterGuest();
          setGuestOnboarded(true); // gate flips straight to the dashboard
          await queryClient.invalidateQueries();
        } finally {
          setHatching(false);
        }
      })();
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        <Reveal delay={40}>
          <Pressable
            onPress={onLogoPress}
            disabled={hatching}
            accessibilityRole="image"
            accessibilityLabel="Markd"
            testID="logo-easter-egg"
            style={{ alignSelf: "flex-start" }}
          >
            <Animated.View style={logoStyle}>
              <Wordmark size={40} />
            </Animated.View>
          </Pressable>
        </Reveal>

        <Reveal delay={120}>
          <Text variant="displayXL" style={{ fontSize: 40, lineHeight: 48 }}>
            {t("auth.welcomeHeadline")}
          </Text>
          <Text variant="body" muted style={{ marginTop: 10, maxWidth: 420 }}>
            {t("auth.welcomeSub")}
          </Text>
        </Reveal>

        <Reveal
          delay={200}
          style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
        >
          <Stamp label="GCSE" rotate={-4} />
          <Stamp label="IGCSE" color={theme.surface} textColor={theme.ink} rotate={3} />
          <Stamp label="IB" rotate={-2} color="#FF7AC3" />
          <Stamp label="A-LEVEL" color={theme.surface} textColor={theme.ink} rotate={5} />
          <Doodle kind="zap" size={26} rotate={10} />
        </Reveal>

        <Reveal delay={300} style={{ gap: 12, marginTop: 18 }}>
          {isSupabaseConfigured ? (
            <>
              <Button
                label={t("auth.signUp")}
                size="lg"
                block
                onPress={() => router.push("/(auth)/sign-up")}
              />
              <Button
                label={t("auth.signIn")}
                variant="secondary"
                size="lg"
                block
                onPress={() => router.push("/(auth)/sign-in")}
              />
              {Platform.OS === "ios" ? (
                <Button
                  label={t("auth.apple")}
                  variant="secondary"
                  size="lg"
                  icon="logo-apple"
                  block
                  onPress={() => router.push("/(auth)/sign-in?apple=1")}
                />
              ) : null}
            </>
          ) : (
            <Slab
              color={theme.well}
              shadow={false}
              contentStyle={{ padding: 14 }}
              style={{ alignSelf: "stretch" }}
            >
              <Text variant="caption" muted>
                {t("auth.notConfigured")}
              </Text>
            </Slab>
          )}
          <Button
            label={t("auth.guest")}
            variant={isSupabaseConfigured ? "ghost" : "primary"}
            size="lg"
            block
            onPress={enterGuest}
            testID="guest-mode"
          />
        </Reveal>
      </View>
    </Screen>
  );
}
