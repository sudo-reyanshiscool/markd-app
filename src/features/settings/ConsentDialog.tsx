import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Sheet, Text } from "@/components/ui";
import { initAnalyticsIfConsented } from "@/lib/observability";
import { useConsentStore } from "@/stores/consent";
import { useSessionStore } from "@/stores/session";

/**
 * One-time analytics opt-in (spec §10). Shown after the user is actually
 * inside the app — never blocks onboarding.
 */
export function ConsentDialog() {
  const { t } = useTranslation();
  const asked = useConsentStore((s) => s.asked);
  const decide = useConsentStore((s) => s.decide);
  const mode = useSessionStore((s) => s.mode);
  const guestOnboarded = useSessionStore((s) => s.guestOnboarded);

  const inApp = mode === "authed" || (mode === "guest" && guestOnboarded);
  const open = inApp && !asked;

  return (
    <Sheet open={open} onClose={() => decide(false)} title={t("consent.title")}>
      <Text variant="body" muted style={{ marginBottom: 18 }}>
        {t("consent.body")}
      </Text>
      <View style={{ gap: 10 }}>
        <Button
          label={t("consent.allow")}
          block
          onPress={() => {
            decide(true);
            initAnalyticsIfConsented();
          }}
        />
        <Button
          label={t("consent.deny")}
          variant="secondary"
          block
          onPress={() => decide(false)}
        />
      </View>
      <Text variant="caption" faint style={{ marginTop: 14 }}>
        {t("consent.note")}
      </Text>
    </Sheet>
  );
}
