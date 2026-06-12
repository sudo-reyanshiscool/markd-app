import React from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Chip,
  Doodle,
  ProgressBar,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { fonts, space, subjectHex } from "@/constants/theme";
import { Subject, Task } from "@/db/schemas";
import { useSubjectMap, TimelineItem } from "@/hooks/domains";
import { SubjectHealth } from "@/utils/gamification";
import { daysAgoISO, formatDateShort, relativeDay } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

// ----------------------------------------------------------- Do next hero
export function DoNextCard({
  task,
  onDone,
  onFocus,
}: {
  task: Task | null;
  onDone: (task: Task) => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const subjects = useSubjectMap();
  const subject = task?.subject_id ? subjects.get(task.subject_id) : undefined;

  return (
    <View>
      <View style={{ position: "absolute", top: -10, left: 6, zIndex: 2 }}>
        <Stamp label={t("home.doNext").toUpperCase()} rotate={-4} color={theme.ink} textColor={theme.name === "light" ? "#FFFDF7" : "#16140F"} />
      </View>
      <Slab
        color={theme.volt}
        radius={24}
        offset={5}
        contentStyle={{ padding: space.xl, paddingTop: space.xl + 6, minHeight: 132 }}
      >
        {task ? (
          <>
            <Text
              variant="display"
              color={theme.onVolt}
              style={{ fontSize: 24, lineHeight: 31 }}
              numberOfLines={3}
            >
              {task.text}
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              {subject ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: subjectHex(subject.color),
                    borderWidth: 1.5,
                    borderColor: theme.border,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    height: 26,
                  }}
                >
                  <Text variant="monoSm" color="#16140F">
                    {subject.name.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {task.due_date ? <DueBadge dateISO={task.due_date} onVolt /> : null}
              {task.estimate_minutes ? (
                <Text variant="monoSm" color={theme.onVolt}>
                  ~{task.estimate_minutes}M
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Slab
                color={theme.ink}
                onPress={() => onDone(task)}
                offset={3}
                radius={12}
                accessibilityLabel={t("common.done")}
                contentStyle={{
                  paddingHorizontal: 16,
                  height: 40,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={theme.name === "light" ? "#FFFDF7" : "#16140F"}
                />
                <Text
                  style={{
                    fontFamily: fonts.bodyBold,
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: theme.name === "light" ? "#FFFDF7" : "#16140F",
                  }}
                >
                  {t("common.done")}
                </Text>
              </Slab>
              <Slab
                color={theme.volt}
                onPress={onFocus}
                offset={3}
                radius={12}
                accessibilityLabel={t("home.startFocus")}
                contentStyle={{
                  paddingHorizontal: 16,
                  height: 40,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Ionicons name="timer-outline" size={16} color={theme.onVolt} />
                <Text
                  style={{
                    fontFamily: fonts.bodyBold,
                    fontSize: 13,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    color: theme.onVolt,
                  }}
                >
                  {t("home.startFocus")}
                </Text>
              </Slab>
            </View>
          </>
        ) : (
          <View style={{ alignItems: "flex-start", gap: 6 }}>
            <Text variant="display" color={theme.onVolt}>
              {t("home.doNextEmpty")}
            </Text>
            <Text variant="bodyMedium" color={theme.onVolt} style={{ opacity: 0.75 }}>
              {t("home.doNextEmptySub")}
            </Text>
            <Doodle kind="squiggle" size={42} color={theme.onVolt} style={{ marginTop: 4 }} />
          </View>
        )}
      </Slab>
    </View>
  );
}

export function DueBadge({ dateISO, onVolt }: { dateISO: string; onVolt?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const rel = relativeDay(dateISO);
  const label =
    rel.kind === "today"
      ? t("common.today")
      : rel.kind === "tomorrow"
        ? t("common.tomorrow")
        : rel.kind === "overdue"
          ? t("common.overdue", { count: rel.days })
          : t("common.inDays", { count: rel.days });
  const urgent = rel.kind === "overdue" || rel.kind === "today";
  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: theme.border,
        borderRadius: 999,
        paddingHorizontal: 10,
        height: 26,
        justifyContent: "center",
        backgroundColor: urgent ? theme.danger : onVolt ? "transparent" : theme.well,
      }}
    >
      <Text
        variant="monoSm"
        color={urgent ? theme.onDanger : onVolt ? theme.onVolt : theme.inkMuted}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------ streak card
export function StreakCard({
  days,
  aliveToday,
  activity,
}: {
  days: number;
  aliveToday: boolean;
  activity: ReadonlySet<string>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const last7 = Array.from({ length: 7 }, (_, i) => daysAgoISO(6 - i));

  return (
    <Slab style={{ flex: 1 }} rotate={-0.6} contentStyle={{ padding: space.lg, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons
          name="flame"
          size={16}
          color={aliveToday ? "#FF7A1F" : theme.inkFaint}
        />
        <Text variant="label" muted>
          {t("home.streak")}
        </Text>
      </View>
      <Text variant="displayXL" style={{ fontSize: 34, lineHeight: 40 }}>
        {days}
        <Text variant="title" muted>
          {"  "}
          {days === 1 ? "day" : "days"}
        </Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 5 }}>
        {last7.map((iso) => (
          <View
            key={iso}
            style={{
              width: 14,
              height: 14,
              borderRadius: 5,
              borderWidth: 1.5,
              borderColor: theme.border,
              backgroundColor: activity.has(iso) ? theme.volt : theme.well,
            }}
          />
        ))}
      </View>
      {!aliveToday && days > 0 ? (
        <Text variant="caption" color={theme.warn}>
          {t("home.streakSub")}
        </Text>
      ) : null}
    </Slab>
  );
}

// ------------------------------------------------------------- level card
export function LevelCard({
  level,
  into,
  span,
  xp,
}: {
  level: number;
  into: number;
  span: number;
  xp: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Slab style={{ flex: 1 }} rotate={0.6} contentStyle={{ padding: space.lg, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name="flash" size={15} color={theme.ink} />
        <Text variant="label" muted>
          {t("home.level", { level })}
        </Text>
      </View>
      <Text variant="displayXL" style={{ fontSize: 34, lineHeight: 40 }}>
        {level}
      </Text>
      <ProgressBar
        value={span === 0 ? 0 : into / span}
        accessibilityLabel={t("home.xpToNext", { xp: span - into, level: level + 1 })}
      />
      <Text variant="monoSm" muted>
        {t("home.xp", { xp })} · {t("home.xpToNext", { xp: span - into, level: level + 1 })}
      </Text>
    </Slab>
  );
}

// ------------------------------------------------------------- week strip
export function WeekStrip({
  tasksDone,
  studyMinutes,
  papersLogged,
}: {
  tasksDone: number;
  studyMinutes: number;
  papersLogged: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const items = [
    { label: t("home.tasksDone"), value: tasksDone, icon: "checkmark-done" as const },
    { label: t("home.studyMinutes"), value: studyMinutes, icon: "timer-outline" as const },
    { label: t("home.papersLogged"), value: papersLogged, icon: "document-text-outline" as const },
  ];
  return (
    <Slab
      shadow={false}
      color={theme.well}
      contentStyle={{
        flexDirection: "row",
        paddingVertical: 12,
        paddingHorizontal: 6,
      }}
    >
      {items.map((item, i) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            alignItems: "center",
            gap: 2,
            borderLeftWidth: i === 0 ? 0 : 1.5,
            borderLeftColor: theme.border,
          }}
        >
          <Ionicons name={item.icon} size={14} color={theme.inkMuted} />
          <Text variant="mono" style={{ fontSize: 20 }}>
            {item.value}
          </Text>
          <Text variant="monoSm" muted style={{ fontSize: 9.5 }}>
            {item.label.toUpperCase()}
          </Text>
        </View>
      ))}
    </Slab>
  );
}

// ------------------------------------------------------ subject health rail
const BAND_LABEL_KEY: Record<string, string> = {
  strong: "subjects.healthStrong",
  steady: "subjects.healthSteady",
  watch: "subjects.healthWatch",
  drifting: "subjects.healthDrifting",
  none: "subjects.healthNone",
};

export function HealthRail({
  subjects,
  healthMap,
}: {
  subjects: Subject[];
  healthMap: Map<string, SubjectHealth>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingVertical: 4, paddingRight: 8 }}
    >
      {subjects.map((subject, i) => {
        const health = healthMap.get(subject.id) ?? {
          score: null,
          band: "none" as const,
          trend: null,
        };
        const pips = health.score === null ? 0 : Math.max(1, Math.round(health.score / 20));
        return (
          <Slab
            key={subject.id}
            onPress={() => router.push(`/subject/${subject.id}`)}
            rotate={i % 2 === 0 ? -1 : 1}
            radius={16}
            accessibilityLabel={`${subject.name}: ${t(BAND_LABEL_KEY[health.band] ?? "subjects.healthNone")}`}
            contentStyle={{ width: 150, overflow: "hidden" }}
          >
            <View
              style={{
                backgroundColor: subjectHex(subject.color),
                paddingHorizontal: 12,
                paddingVertical: 9,
                borderBottomWidth: 2,
                borderBottomColor: theme.border,
                borderTopLeftRadius: 14,
                borderTopRightRadius: 14,
              }}
            >
              <Text
                style={{ fontFamily: fonts.display, fontSize: 12.5, color: "#16140F" }}
                numberOfLines={1}
              >
                {subject.name.toUpperCase()}
              </Text>
            </View>
            <View style={{ padding: 12, gap: 7 }}>
              <View style={{ flexDirection: "row", gap: 4 }}>
                {Array.from({ length: 5 }, (_, p) => (
                  <View
                    key={p}
                    style={{
                      flex: 1,
                      height: 9,
                      borderRadius: 4,
                      borderWidth: 1.2,
                      borderColor: theme.border,
                      backgroundColor:
                        p < pips
                          ? health.band === "drifting" || health.band === "watch"
                            ? theme.warn
                            : theme.volt
                          : theme.well,
                    }}
                  />
                ))}
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text variant="monoSm" muted>
                  {t(BAND_LABEL_KEY[health.band] ?? "subjects.healthNone").toUpperCase()}
                </Text>
                {health.trend === "up" ? (
                  <Ionicons name="trending-up" size={12} color={theme.success} />
                ) : health.trend === "down" ? (
                  <Ionicons name="trending-down" size={12} color={theme.danger} />
                ) : null}
                {subject.target_grade ? (
                  <View style={{ marginLeft: "auto" }}>
                    <Stamp label={subject.target_grade} size="sm" rotate={4} />
                  </View>
                ) : null}
              </View>
            </View>
          </Slab>
        );
      })}
    </ScrollView>
  );
}

// --------------------------------------------------------------- upcoming
const KIND_ICON: Record<TimelineItem["kind"], keyof typeof Ionicons.glyphMap> = {
  task: "checkbox-outline",
  deadline: "alarm-outline",
  exam: "school-outline",
  event: "calendar-outline",
};

export function UpcomingList({ items }: { items: TimelineItem[] }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const subjects = useSubjectMap();

  if (items.length === 0) {
    return (
      <Slab shadow={false} color={theme.well} contentStyle={{ padding: 16 }}>
        <Text variant="bodyMedium" muted>
          {t("home.upcomingEmpty")}
        </Text>
      </Slab>
    );
  }

  return (
    <View style={{ gap: 10 }}>
      {items.map((item) => {
        const title =
          item.kind === "task"
            ? item.task.text
            : item.kind === "deadline"
              ? item.deadline.title
              : item.kind === "exam"
                ? item.exam.name
                : item.event.title;
        const subjectId =
          item.kind === "task"
            ? item.task.subject_id
            : item.kind === "deadline"
              ? item.deadline.subject_id
              : item.kind === "exam"
                ? item.exam.subject_id
                : null;
        const subject = subjectId ? subjects.get(subjectId) : undefined;
        return (
          <Slab
            key={`${item.kind}-${title}-${item.date}`}
            offset={3}
            radius={14}
            contentStyle={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 14,
              paddingVertical: 11,
            }}
          >
            <View
              style={{
                width: 6,
                alignSelf: "stretch",
                borderRadius: 3,
                backgroundColor: subject ? subjectHex(subject.color) : theme.well,
                borderWidth: subject ? 1.2 : 0,
                borderColor: theme.border,
              }}
            />
            <Ionicons name={KIND_ICON[item.kind]} size={16} color={theme.inkMuted} />
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="monoSm" muted>
                {formatDateShort(item.date)}
              </Text>
            </View>
            <DueBadge dateISO={item.date} />
          </Slab>
        );
      })}
    </View>
  );
}

// -------------------------------------------------------------- motivation
export function MotivationCard({ line }: { line: string | undefined }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!line) return null;
  return (
    <Slab
      rotate={-0.8}
      color={theme.name === "light" ? "#16140F" : "#F4F0E6"}
      contentStyle={{ padding: space.lg, gap: 6 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Doodle kind="zap" size={16} color={theme.name === "light" ? "#C8FF1F" : "#16140F"} filled />
        <Text
          variant="label"
          color={theme.name === "light" ? "#C8FF1F" : "#16140F"}
        >
          {t("home.motivation")}
        </Text>
      </View>
      <Text
        variant="heading"
        color={theme.name === "light" ? "#FFFDF7" : "#16140F"}
        style={{ fontSize: 18, lineHeight: 25 }}
      >
        “{line}”
      </Text>
    </Slab>
  );
}
