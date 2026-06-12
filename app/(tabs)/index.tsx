import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { Reveal, Screen, SectionHeader, Text, Wordmark } from "@/components/ui";
import { space } from "@/constants/theme";
import { useProfile } from "@/features/auth/hooks";
import {
  DoNextCard,
  HealthRail,
  LevelCard,
  MotivationCard,
  StreakCard,
  UpcomingList,
  WeekStrip,
} from "@/features/home/components";
import {
  useGamification,
  useMotivation,
  useSubjectHealthMap,
  useSubjects,
  useTasks,
  useTimeline,
} from "@/hooks/domains";
import { useEntityList } from "@/hooks/useEntities";
import { activityDateSet } from "@/utils/gamification";
import { formatDateShort, todayISO } from "@/utils/dates";
import { useLocalProfileName } from "@/features/settings/useLocalProfile";
import { useSessionStore } from "@/stores/session";
import { setStreakReminder } from "@/lib/notifications";
import { thud } from "@/lib/haptics";

export default function Home() {
  const { t } = useTranslation();
  const router = useRouter();
  const game = useGamification();
  const { active } = useSubjects();
  const healthMap = useSubjectHealthMap();
  const timeline = useTimeline();
  const motivation = useMotivation();
  const tasks = useTasks();
  const taskRows = useEntityList("tasks");
  const sessionRows = useEntityList("study_sessions");
  const mode = useSessionStore((s) => s.mode);
  const profile = useProfile();
  const guestName = useLocalProfileName();

  const name = mode === "authed" ? (profile.data?.name ?? "") : (guestName ?? "");
  const firstName = name.trim().split(/\s+/)[0] ?? "";
  const activity = activityDateSet(taskRows.data ?? [], sessionRows.data ?? []);

  const upcoming = timeline.items
    .filter((i) => i.date >= todayISO())
    .slice(0, 4);

  React.useEffect(() => {
    void setStreakReminder(game.streak.atRisk);
  }, [game.streak.atRisk]);

  return (
    <Screen scroll dock>
      <Reveal delay={20}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text variant="monoSm" muted>
              {formatDateShort(todayISO())}
            </Text>
            <Text variant="displayXL" style={{ marginTop: 2 }}>
              {firstName
                ? t("home.greeting", { name: firstName })
                : t("home.greetingAnon")}
            </Text>
          </View>
          <Wordmark size={17} />
        </View>
      </Reveal>

      <Reveal delay={90} style={{ marginTop: space.xl }}>
        <DoNextCard
          task={game.doNext}
          onDone={(task) => {
            thud();
            void tasks.complete(task);
          }}
          onFocus={() => router.push("/focus")}
        />
      </Reveal>

      <Reveal delay={160} style={{ flexDirection: "row", gap: 12, marginTop: space.xl }}>
        <StreakCard
          days={game.streak.days}
          aliveToday={game.streak.aliveToday}
          activity={activity}
        />
        <LevelCard
          level={game.level.level}
          into={game.level.into}
          span={game.level.span}
          xp={game.xp}
        />
      </Reveal>

      <Reveal delay={220} style={{ marginTop: space.lg }}>
        <WeekStrip
          tasksDone={game.week.tasksDone}
          studyMinutes={game.week.studyMinutes}
          papersLogged={game.week.papersLogged}
        />
      </Reveal>

      {active.length > 0 ? (
        <Reveal delay={260}>
          <SectionHeader
            title={t("home.subjectHealth")}
            action={t("home.seeAll")}
            onAction={() => router.push("/(tabs)/subjects")}
          />
          <HealthRail subjects={active} healthMap={healthMap} />
        </Reveal>
      ) : null}

      <Reveal delay={300}>
        <SectionHeader
          title={t("home.upcoming")}
          action={t("home.seeAll")}
          onAction={() => router.push("/(tabs)/timeline")}
        />
        <UpcomingList items={upcoming} />
      </Reveal>

      <Reveal delay={340} style={{ marginTop: space.xxl }}>
        <MotivationCard line={motivation.data} />
      </Reveal>
    </Screen>
  );
}
