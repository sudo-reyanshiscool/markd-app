import React, { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Chip, EmptyState, Reveal, Screen, Slab, Text } from "@/components/ui";
import { fonts, space, subjectHex } from "@/constants/theme";
import { TimelineItem, useSubjectMap, useSubjects, useTimeline } from "@/hooks/domains";
import { formatDateShort, todayISO } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

import { DueBadge } from "@/features/home/components";

type Row =
  | { type: "date"; date: string }
  | { type: "item"; item: TimelineItem; last: boolean };

const KIND_ICON = {
  task: "checkbox-outline",
  deadline: "alarm-outline",
  exam: "school-outline",
  event: "calendar-outline",
} as const;

export default function Timeline() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { active } = useSubjects();
  const subjects = useSubjectMap();
  const [filter, setFilter] = useState<string | null>(null);
  const timeline = useTimeline(filter);

  const today = todayISO();
  const rows = useMemo<Row[]>(() => {
    const upcoming = timeline.items.filter((i) => i.date >= today);
    const out: Row[] = [];
    let currentDate = "";
    upcoming.forEach((item, idx) => {
      if (item.date !== currentDate) {
        currentDate = item.date;
        out.push({ type: "date", date: item.date });
      }
      const next = upcoming[idx + 1];
      out.push({ type: "item", item, last: !next || next.date !== item.date });
    });
    return out;
  }, [timeline.items, today]);

  const kindLabel: Record<TimelineItem["kind"], string> = {
    task: t("timeline.task"),
    deadline: t("timeline.deadline"),
    exam: t("timeline.exam"),
    event: t("timeline.event"),
  };

  return (
    <Screen dock contentStyle={{ paddingTop: 4 }}>
      <Reveal delay={20}>
        <Text variant="displayXL">{t("timeline.title")}</Text>
      </Reveal>

      <Reveal delay={80} style={{ marginVertical: space.lg }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip
            label={t("timeline.all")}
            active={filter === null}
            onPress={() => setFilter(null)}
          />
          {active.map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              active={filter === s.id}
              activeColor={subjectHex(s.color)}
              onPress={() => setFilter(filter === s.id ? null : s.id)}
            />
          ))}
        </ScrollView>
      </Reveal>

      {rows.length === 0 ? (
        <EmptyState
          title={t("timeline.empty")}
          body={t("timeline.emptySub")}
          doodle="squiggle"
        />
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row, i) =>
            row.type === "date" ? `d-${row.date}` : `i-${i}`
          }
          getItemType={(row) => row.type}
          renderItem={({ item: row }) => {
            if (row.type === "date") {
              const isToday = row.date === today;
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 18,
                    marginBottom: 10,
                  }}
                >
                  {/* metro station node */}
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      borderWidth: 2.5,
                      borderColor: theme.border,
                      backgroundColor: isToday ? theme.volt : theme.surface,
                      marginLeft: 4,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: fonts.monoBold,
                      fontSize: 13,
                      letterSpacing: 1,
                      color: isToday ? theme.ink : theme.inkMuted,
                    }}
                  >
                    {isToday ? t("timeline.today").toUpperCase() : formatDateShort(row.date)}
                  </Text>
                </View>
              );
            }

            const { item, last } = row;
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
              <View style={{ flexDirection: "row" }}>
                {/* metro line */}
                <View style={{ width: 24, alignItems: "center" }}>
                  <View
                    style={{
                      flex: 1,
                      width: 2.5,
                      backgroundColor: theme.border,
                      opacity: 0.5,
                      marginBottom: last ? 6 : 0,
                    }}
                  />
                </View>
                <View style={{ flex: 1, marginBottom: 10 }}>
                  <Slab
                    offset={3}
                    radius={14}
                    contentStyle={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      paddingHorizontal: 13,
                      paddingVertical: 11,
                    }}
                  >
                    <View
                      style={{
                        width: 6,
                        alignSelf: "stretch",
                        borderRadius: 3,
                        backgroundColor: subject
                          ? subjectHex(subject.color)
                          : theme.well,
                        borderWidth: subject ? 1.2 : 0,
                        borderColor: theme.border,
                      }}
                    />
                    <Ionicons
                      name={KIND_ICON[item.kind]}
                      size={16}
                      color={theme.inkMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyBold" numberOfLines={2}>
                        {title}
                      </Text>
                      <Text variant="monoSm" muted>
                        {kindLabel[item.kind].toUpperCase()}
                        {subject ? ` · ${subject.name.toUpperCase()}` : ""}
                      </Text>
                    </View>
                    <DueBadge dateISO={item.date} />
                  </Slab>
                </View>
              </View>
            );
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 130 }}
        />
      )}
    </Screen>
  );
}
