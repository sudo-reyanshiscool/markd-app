import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  IconButton,
  Reveal,
  Screen,
  Slab,
  Stamp,
  Text,
  Wordmark,
} from "@/components/ui";
import { isEduEmail, PRICES } from "@/lib/entitlements";
import { purchase, PurchaseOption, purchasesAvailable, restorePurchases } from "@/lib/purchases";
import { useSessionStore } from "@/stores/session";
import { useTheme } from "@/providers/theme";

const FEATURES = [
  { icon: "sparkles" as const, key: "paywall.featAi" },
  { icon: "infinite" as const, key: "paywall.featUnlimited" },
  { icon: "calendar-number" as const, key: "paywall.featCalendar" },
  { icon: "git-branch" as const, key: "paywall.featBreakdown" },
  { icon: "download" as const, key: "paywall.featExports" },
  { icon: "link" as const, key: "paywall.featShare" },
];

export default function Paywall() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const email = useSessionStore((s) => s.email);
  const [option, setOption] = useState<PurchaseOption>("pro_yearly");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const edu = email ? isEduEmail(email) : false;

  const buy = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await purchase(option);
      if (result === "unavailable") setNotice(t("paywall.notAvailable"));
      else if (result === "success") router.back();
    } catch {
      setNotice(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const options: { key: PurchaseOption; label: string; sub?: string }[] = [
    { key: "pro_monthly", label: t("paywall.monthly") },
    { key: "pro_yearly", label: t("paywall.yearly"), sub: "BEST VALUE" },
    { key: "family_yearly", label: t("paywall.family"), sub: t("paywall.family4") },
  ];

  return (
    <Screen scroll>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={22} />
        <IconButton icon="close" label={t("common.close")} onPress={() => router.back()} />
      </View>

      <Reveal delay={40} style={{ marginTop: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Text variant="displayXL" style={{ fontSize: 34, lineHeight: 42, flex: 1 }}>
            {t("paywall.headline")}
          </Text>
          <Stamp label={t("paywall.trial")} rotate={5} />
        </View>
        {edu ? (
          <Text variant="caption" color={theme.success} style={{ marginTop: 6 }}>
            ✓ {t("paywall.edu")} — {PRICES.eduDiscountPct}%
          </Text>
        ) : null}
      </Reveal>

      <Reveal delay={120} style={{ gap: 10, marginTop: 22 }}>
        {FEATURES.map((f) => (
          <View key={f.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 10,
                backgroundColor: theme.volt,
                borderWidth: 1.5,
                borderColor: theme.border,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={f.icon} size={15} color={theme.onVolt} />
            </View>
            <Text variant="bodyMedium" style={{ flex: 1 }}>
              {t(f.key)}
            </Text>
          </View>
        ))}
      </Reveal>

      <Reveal delay={200} style={{ gap: 10, marginTop: 26 }}>
        {options.map((o) => {
          const selected = option === o.key;
          return (
            <Slab
              key={o.key}
              onPress={() => setOption(o.key)}
              color={selected ? theme.volt : theme.surface}
              radius={16}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              contentStyle={{
                paddingHorizontal: 16,
                height: 58,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text variant="title" color={selected ? theme.onVolt : theme.ink}>
                {o.label}
              </Text>
              {o.sub ? (
                <Stamp
                  label={o.sub}
                  size="sm"
                  rotate={3}
                  color={selected ? theme.surface : undefined}
                  textColor={theme.ink}
                />
              ) : null}
            </Slab>
          );
        })}
      </Reveal>

      {notice ? (
        <Reveal style={{ marginTop: 14 }}>
          <Slab shadow={false} color={theme.well} contentStyle={{ padding: 12 }}>
            <Text variant="caption" muted>
              {notice}
            </Text>
          </Slab>
        </Reveal>
      ) : null}

      <Reveal delay={260} style={{ gap: 10, marginTop: 20, marginBottom: 30 }}>
        <Button label={t("paywall.cta")} size="lg" block loading={busy} onPress={buy} testID="paywall-cta" />
        {Platform.OS !== "web" && purchasesAvailable() ? (
          <Button
            label={t("paywall.restore")}
            variant="ghost"
            block
            onPress={() => void restorePurchases()}
          />
        ) : null}
        <Button label={t("paywall.later")} variant="ghost" block onPress={() => router.back()} />
      </Reveal>
    </Screen>
  );
}
