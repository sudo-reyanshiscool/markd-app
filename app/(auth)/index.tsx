import React from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

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
import { isSupabaseConfigured } from "@/lib/supabase";
import { useTheme } from "@/providers/theme";
import { useSessionStore } from "@/stores/session";

export default function Welcome() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const enterGuest = useSessionStore((s) => s.enterGuest);

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: 18 }}>
        <Reveal delay={40}>
          <Wordmark size={40} />
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
