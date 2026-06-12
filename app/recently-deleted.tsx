import React from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";


import {
  Button,
  EmptyState,
  Reveal,
  Screen,
  ScreenHeader,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { useDeletionLog } from "@/hooks/useEntities";
import { formatDateLong, timestampToLocalISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

const TYPE_LABEL_KEY: Record<string, string> = {
  subjects: "tabs.subjects",
  tasks: "tabs.tasks",
  deadlines: "timeline.deadline",
  exams: "timeline.exam",
  papers: "more.papers",
  goals: "more.goals",
  portfolio_entries: "more.portfolio",
  activities: "more.activities",
};

export default function RecentlyDeleted() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { entries, restore, purge } = useDeletionLog();

  const rows = (entries.data ?? [])
    .filter((e) => !e.restored_at)
    .sort((a, b) => (a.deleted_at > b.deleted_at ? -1 : 1));

  return (
    <Screen scroll>
      <ScreenHeader title={t("deleted.title")} />
      {rows.length === 0 ? (
        <EmptyState title={t("deleted.empty")} body={t("deleted.emptySub")} doodle="squiggle" />
      ) : (
        <View style={{ gap: 10, paddingBottom: 40 }}>
          {rows.map((entry, i) => {
            const snapshot = entry.snapshot as Record<string, unknown>;
            const label =
              (snapshot.name as string) ||
              (snapshot.text as string) ||
              (snapshot.title as string) ||
              entry.entity_type;
            return (
              <Reveal key={entry.id} delay={40 + Math.min(i, 8) * 30}>
                <Slab radius={14} offset={3} contentStyle={{ padding: 13, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Stamp
                      label={t(TYPE_LABEL_KEY[entry.entity_type] ?? entry.entity_type)}
                      size="sm"
                      color={theme.well}
                      textColor={theme.ink}
                      rotate={-2}
                    />
                    <Text variant="monoSm" faint style={{ marginLeft: "auto" }}>
                      {t("deleted.deletedAt", {
                        date: formatDateLong(timestampToLocalISODate(entry.deleted_at)),
                      })}
                    </Text>
                  </View>
                  <Text variant="bodyBold" numberOfLines={2}>
                    {label}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button
                      label={t("deleted.restore")}
                      size="sm"
                      icon="refresh"
                      onPress={() => void restore.mutateAsync(entry.id)}
                    />
                    <Button
                      label={t("deleted.purge")}
                      variant="danger"
                      size="sm"
                      onPress={() => void purge.mutateAsync(entry.id)}
                    />
                  </View>
                </Slab>
              </Reveal>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
