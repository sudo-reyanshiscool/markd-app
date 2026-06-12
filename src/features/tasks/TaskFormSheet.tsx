import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Chip, DateField, Input, Sheet, Text } from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { Recurrence, Task } from "@/db/schemas";
import { useSubjects, useTasks } from "@/hooks/domains";
import { useTheme } from "@/providers/theme";

const PRIORITIES = [1, 2, 3, 4, 5];
const ESTIMATES = [15, 30, 45, 60, 90, 120];

export interface TaskFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Editing an existing task, or null for create. */
  task: Task | null;
}

export function TaskFormSheet({ open, onClose, task }: TaskFormSheetProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { active } = useSubjects();
  const tasks = useTasks();

  const [text, setText] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState(3);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setText(task?.text ?? "");
      setSubjectId(task?.subject_id ?? null);
      setDueDate(task?.due_date ?? null);
      setPriority(task?.priority ?? 3);
      setEstimate(task?.estimate_minutes ?? null);
      setRecurrence(task?.recurrence ?? null);
    }
  }, [open, task]);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (task) {
        await tasks.update.mutateAsync({
          id: task.id,
          patch: {
            text: text.trim(),
            subject_id: subjectId,
            due_date: dueDate,
            priority,
            estimate_minutes: estimate,
            recurrence,
          },
        });
      } else {
        await tasks.add.mutateAsync({
          text: text.trim(),
          subject_id: subjectId,
          due_date: dueDate,
          priority,
          estimate_minutes: estimate,
          recurrence,
          topic: null,
          done: false,
          snoozed_until: null,
          completed_at: null,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const recurrenceOptions: { label: string; value: Recurrence | null }[] = [
    { label: t("tasks.repeatNone"), value: null },
    { label: t("tasks.repeatDaily"), value: { freq: "daily", interval: 1 } },
    { label: t("tasks.repeatWeekly"), value: { freq: "weekly", interval: 1 } },
    { label: t("tasks.repeatMonthly"), value: { freq: "monthly", interval: 1 } },
  ];

  return (
    <Sheet open={open} onClose={onClose} title={task ? t("tasks.edit") : t("tasks.add")}>
      <View style={{ gap: 18, paddingBottom: 8 }}>
        <Input
          label={t("tasks.text")}
          value={text}
          onChangeText={setText}
          maxLength={500}
          multiline
          testID="task-text"
        />

        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("tasks.subject")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip
              label={t("tasks.noSubject")}
              active={subjectId === null}
              onPress={() => setSubjectId(null)}
            />
            {active.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                active={subjectId === s.id}
                activeColor={subjectHex(s.color)}
                onPress={() => setSubjectId(s.id)}
              />
            ))}
          </View>
        </View>

        <DateField label={t("tasks.due")} value={dueDate} onChange={setDueDate} />

        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("tasks.priority")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {PRIORITIES.map((p) => (
              <Chip
                key={p}
                label={`P${p}`}
                active={priority === p}
                activeColor={p >= 4 ? theme.danger : undefined}
                onPress={() => setPriority(p)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("tasks.estimate")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {ESTIMATES.map((m) => (
              <Chip
                key={m}
                label={`${m}m`}
                active={estimate === m}
                onPress={() => setEstimate(estimate === m ? null : m)}
              />
            ))}
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("tasks.repeats")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {recurrenceOptions.map((o) => (
              <Chip
                key={o.label}
                label={o.label}
                active={JSON.stringify(recurrence?.freq ?? null) === JSON.stringify(o.value?.freq ?? null)}
                onPress={() => setRecurrence(o.value)}
              />
            ))}
          </View>
        </View>

        <Button
          label={t("common.save")}
          size="lg"
          block
          loading={busy}
          disabled={!text.trim()}
          onPress={save}
          testID="task-save"
        />
        {task ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button
              label={t("tasks.snoozeUntilTomorrow")}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={async () => {
                const until = new Date();
                until.setDate(until.getDate() + 1);
                until.setHours(7, 0, 0, 0);
                await tasks.snooze(task, until.toISOString());
                onClose();
              }}
            />
            <Button
              label={t("tasks.snoozeWeek")}
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={async () => {
                const until = new Date();
                until.setDate(until.getDate() + 7);
                until.setHours(7, 0, 0, 0);
                await tasks.snooze(task, until.toISOString());
                onClose();
              }}
            />
          </View>
        ) : null}
        {task ? (
          <Button
            label={t("common.delete")}
            variant="danger"
            block
            onPress={async () => {
              await tasks.remove.mutateAsync(task.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}
