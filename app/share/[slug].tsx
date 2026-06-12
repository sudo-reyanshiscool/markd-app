import React from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  EmptyState,
  Reveal,
  Screen,
  Slab,
  Stamp,
  Text,
  Wordmark,
} from "@/components/ui";
import { fonts, space } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { formatDateShort } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

interface SharePayload {
  first_name?: string;
  subjects?: { name: string; target_grade?: string | null }[];
  streak_days?: number;
  level?: number;
  xp?: number;
  upcoming?: { title: string; date: string; kind: string }[];
  week?: { tasks_done?: number; study_minutes?: number };
}

/** Public read-only share view (spec §7.17) — no auth, served via get_share RPC. */
export default function ShareView() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const share = useQuery({
    queryKey: ["public-share", slug],
    queryFn: async (): Promise<SharePayload | null> => {
      if (!supabase || !slug) return null;
      const { data, error } = await supabase.rpc("get_share", { p_slug: slug });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row?.payload as SharePayload | undefined) ?? null;
    },
    retry: 1,
  });

  if (share.isPending) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Wordmark size={28} />
        </View>
      </Screen>
    );
  }

  const payload = share.data;
  if (!payload) {
    return (
      <Screen>
        <View style={{ paddingTop: 30 }}>
          <Wordmark size={24} />
        </View>
        <EmptyState
          title={t("share.publicExpired")}
          body={t("share.publicExpiredSub")}
          doodle="squiggle"
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ paddingVertical: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={22} />
        <Text variant="monoSm" muted>
          {t("share.publicBy").toUpperCase()}
        </Text>
      </View>

      <Reveal delay={50}>
        <Text variant="displayXL" style={{ fontSize: 32, lineHeight: 40, marginTop: 14 }}>
          {t("share.publicTitle", { name: payload.first_name ?? "Student" })}
        </Text>
      </Reveal>

      <Reveal delay={120} style={{ flexDirection: "row", gap: 12, marginTop: 20 }}>
        <Slab style={{ flex: 1 }} rotate={-0.8} contentStyle={{ padding: 16, gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Ionicons name="flame" size={14} color="#FF7A1F" />
            <Text variant="label" muted>
              {t("share.publicStreak")}
            </Text>
          </View>
          <Text variant="displayXL">{payload.streak_days ?? 0}</Text>
        </Slab>
        <Slab style={{ flex: 1 }} rotate={0.8} contentStyle={{ padding: 16, gap: 4 }}>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Ionicons name="flash" size={14} color={theme.ink} />
            <Text variant="label" muted>
              {t("share.publicLevel")}
            </Text>
          </View>
          <Text variant="displayXL">{payload.level ?? 1}</Text>
        </Slab>
      </Reveal>

      {payload.subjects?.length ? (
        <Reveal delay={180} style={{ marginTop: space.xl }}>
          <Text variant="label" muted style={{ marginBottom: 10 }}>
            {t("tabs.subjects")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {payload.subjects.map((s, i) => (
              <Stamp
                key={i}
                label={s.target_grade ? `${s.name} → ${s.target_grade}` : s.name}
                rotate={i % 2 ? 2 : -2}
                color={i % 2 ? theme.surface : undefined}
                textColor={theme.ink}
              />
            ))}
          </View>
        </Reveal>
      ) : null}

      {payload.upcoming?.length ? (
        <Reveal delay={240} style={{ marginTop: space.xxl }}>
          <Text variant="label" muted style={{ marginBottom: 10 }}>
            {t("share.publicUpcoming")}
          </Text>
          <View style={{ gap: 8 }}>
            {payload.upcoming.map((u, i) => (
              <Slab key={i} shadow={false} color={theme.well} radius={12} contentStyle={{ padding: 12, flexDirection: "row", gap: 10, alignItems: "center" }}>
                <Text style={{ fontFamily: fonts.monoBold, fontSize: 12, color: theme.inkMuted }}>
                  {formatDateShort(u.date)}
                </Text>
                <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                  {u.title}
                </Text>
              </Slab>
            ))}
          </View>
        </Reveal>
      ) : null}

      {payload.week ? (
        <Reveal delay={300} style={{ marginTop: space.xxl, marginBottom: 30 }}>
          <Text variant="label" muted style={{ marginBottom: 10 }}>
            {t("share.publicWeek")}
          </Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Slab shadow={false} color={theme.well} style={{ flex: 1 }} contentStyle={{ padding: 14, alignItems: "center" }}>
              <Text variant="mono" style={{ fontSize: 22 }}>
                {payload.week.tasks_done ?? 0}
              </Text>
              <Text variant="monoSm" muted>
                {t("home.tasksDone").toUpperCase()}
              </Text>
            </Slab>
            <Slab shadow={false} color={theme.well} style={{ flex: 1 }} contentStyle={{ padding: 14, alignItems: "center" }}>
              <Text variant="mono" style={{ fontSize: 22 }}>
                {payload.week.study_minutes ?? 0}
              </Text>
              <Text variant="monoSm" muted>
                {t("home.studyMinutes").toUpperCase()}
              </Text>
            </Slab>
          </View>
        </Reveal>
      ) : null}
    </Screen>
  );
}
