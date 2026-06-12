import React from "react";
import { View } from "react-native";
import { Href, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Reveal, Screen, Slab, Stamp, Text } from "@/components/ui";
import { fonts, space } from "@/constants/theme";
import { usePlan } from "@/hooks/useEntitlement";
import { useSessionStore } from "@/stores/session";
import { useTheme } from "@/providers/theme";

interface Entry {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  titleKey: string;
  subKey: string;
  pro?: boolean;
  tilt: number;
}

const ENTRIES: Entry[] = [
  { href: "/exams", icon: "school", titleKey: "more.exams", subKey: "more.examsSub", tilt: -0.8 },
  { href: "/papers", icon: "document-text", titleKey: "more.papers", subKey: "more.papersSub", tilt: 0.6 },
  { href: "/goals", icon: "golf", titleKey: "more.goals", subKey: "more.goalsSub", tilt: -0.5 },
  { href: "/portfolio", icon: "trophy", titleKey: "more.portfolio", subKey: "more.portfolioSub", tilt: 0.9 },
  { href: "/activities", icon: "basketball", titleKey: "more.activities", subKey: "more.activitiesSub", tilt: -0.7 },
  { href: "/syllabus", icon: "library", titleKey: "more.syllabus", subKey: "more.syllabusSub", pro: true, tilt: 0.5 },
  { href: "/focus", icon: "timer", titleKey: "more.focus", subKey: "more.focusSub", tilt: -0.6 },
  { href: "/ai", icon: "sparkles", titleKey: "more.ai", subKey: "more.aiSub", tilt: 0.8 },
  { href: "/calendar", icon: "calendar-number", titleKey: "more.calendar", subKey: "more.calendarSub", pro: true, tilt: -0.9 },
  { href: "/share-manage", icon: "link", titleKey: "more.share", subKey: "more.shareSub", pro: true, tilt: 0.7 },
  { href: "/recently-deleted", icon: "trash-bin", titleKey: "more.recentlyDeleted", subKey: "more.recentlyDeletedSub", tilt: -0.4 },
  { href: "/settings", icon: "settings", titleKey: "more.settings", subKey: "more.settingsSub", tilt: 0.5 },
];

export default function More() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const plan = usePlan();
  const mode = useSessionStore((s) => s.mode);

  const planLabel =
    plan === "free" ? t("more.planFree") : plan === "pro" ? t("more.planPro") : t("more.planFamily");

  return (
    <Screen scroll dock>
      <Reveal delay={20}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="displayXL">{t("more.title")}</Text>
          <Slab
            onPress={() => router.push("/paywall")}
            color={plan === "free" ? theme.surface : theme.volt}
            offset={3}
            radius={999}
            accessibilityLabel={planLabel}
            contentStyle={{
              paddingHorizontal: 14,
              height: 34,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons
              name={plan === "free" ? "rocket-outline" : "rocket"}
              size={14}
              color={plan === "free" ? theme.ink : theme.onVolt}
            />
            <Text
              style={{
                fontFamily: fonts.bodyBold,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: plan === "free" ? theme.ink : theme.onVolt,
              }}
            >
              {planLabel}
            </Text>
          </Slab>
        </View>
        {mode === "guest" ? (
          <Slab
            shadow={false}
            color={theme.well}
            style={{ marginTop: space.md }}
            contentStyle={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Ionicons name="cloud-offline-outline" size={15} color={theme.inkMuted} />
            <Text variant="caption" muted style={{ flex: 1 }}>
              {t("demo.banner")}
            </Text>
          </Slab>
        ) : null}
      </Reveal>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 12,
          marginTop: space.xl,
        }}
      >
        {ENTRIES.map((entry, i) => (
          <Reveal
            key={entry.titleKey}
            delay={60 + i * 35}
            style={{ flexBasis: "47%", flexGrow: 1 }}
          >
            <Slab
              onPress={() => router.push(entry.href)}
              rotate={entry.tilt}
              radius={16}
              accessibilityLabel={t(entry.titleKey)}
              contentStyle={{ padding: 14, gap: 8, minHeight: 96 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Ionicons name={entry.icon} size={20} color={theme.ink} />
                {entry.pro && plan === "free" ? <Stamp label="PRO" size="sm" rotate={6} /> : null}
              </View>
              <View>
                <Text variant="title" numberOfLines={1}>
                  {t(entry.titleKey)}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                  {t(entry.subKey)}
                </Text>
              </View>
            </Slab>
          </Reveal>
        ))}
      </View>
    </Screen>
  );
}
