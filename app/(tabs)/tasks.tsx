import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useTranslation } from "react-i18next";

import {
  EmptyState,
  Reveal,
  Screen,
  SectionHeader,
  Text,
} from "@/components/ui";
import { space } from "@/constants/theme";
import { Task } from "@/db/schemas";
import { QuickAdd } from "@/features/tasks/QuickAdd";
import { TaskFormSheet } from "@/features/tasks/TaskFormSheet";
import { TaskRow } from "@/features/tasks/TaskRow";
import { useSubjectMap, useTasks } from "@/hooks/domains";

type RowItem =
  | { type: "task"; task: Task }
  | { type: "header"; key: string; label: string }
  | { type: "quickadd" }
  | { type: "empty" };

export default function Tasks() {
  const { t } = useTranslation();
  const tasks = useTasks();
  const subjects = useSubjectMap();
  const [editing, setEditing] = useState<Task | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const rows = useMemo<RowItem[]>(() => {
    const out: RowItem[] = [{ type: "quickadd" }];
    if (tasks.open.length === 0 && tasks.done.length === 0 && tasks.snoozed.length === 0) {
      out.push({ type: "empty" });
      return out;
    }
    for (const task of tasks.open) out.push({ type: "task", task });
    if (tasks.snoozed.length) {
      out.push({ type: "header", key: "snoozed", label: t("tasks.snoozedSection") });
      for (const task of tasks.snoozed) out.push({ type: "task", task });
    }
    if (tasks.done.length) {
      out.push({ type: "header", key: "done", label: t("tasks.doneSection") });
      for (const task of tasks.done.slice(0, 15)) out.push({ type: "task", task });
    }
    return out;
  }, [tasks.open, tasks.done, tasks.snoozed, t]);

  return (
    <Screen dock contentStyle={{ paddingTop: 4 }}>
      <Reveal delay={20}>
        <Text variant="displayXL" style={{ marginBottom: space.lg }}>
          {t("tasks.title")}
        </Text>
      </Reveal>
      <FlashList
        data={rows}
        keyExtractor={(item) =>
          item.type === "task"
            ? item.task.id
            : item.type === "header"
              ? item.key
              : item.type
        }
        getItemType={(item) => item.type}
        renderItem={({ item }) => {
          switch (item.type) {
            case "quickadd":
              return (
                <View style={{ marginBottom: space.lg }}>
                  <QuickAdd />
                </View>
              );
            case "empty":
              return (
                <EmptyState
                  title={t("tasks.empty")}
                  body={t("tasks.emptySub")}
                  doodle="zap"
                />
              );
            case "header":
              return <SectionHeader title={item.label} style={{ marginTop: space.lg }} />;
            case "task":
              return (
                <View style={{ marginBottom: 10 }}>
                  <TaskRow
                    task={item.task}
                    subject={
                      item.task.subject_id
                        ? subjects.get(item.task.subject_id)
                        : undefined
                    }
                    onComplete={(task) => void tasks.complete(task)}
                    onUncomplete={(task) => void tasks.uncomplete(task)}
                    onPress={(task) => {
                      if (task.done) return;
                      setEditing(task);
                      setFormOpen(true);
                    }}
                  />
                </View>
              );
          }
        }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
      />

      <TaskFormSheet
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        task={editing}
      />
    </Screen>
  );
}
