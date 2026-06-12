import React, { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  Chip,
  EmptyState,
  FAB,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  SectionHeader,
  Sheet,
  Slab,
  Text,
} from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { Goal } from "@/db/schemas";
import { useGoals, useSubjectMap, useSubjects } from "@/hooks/domains";
import { formatDateLong, timestampToLocalISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

const HORIZONS = ["3m", "6m", "9m", "12m"] as const;

function GoalForm({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: Goal | null }) {
  const { t } = useTranslation();
  const goals = useGoals();
  const { active } = useSubjects();
  const [text, setText] = useState("");
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>("3m");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) {
      setText(goal?.text ?? "");
      setHorizon(goal?.horizon ?? "3m");
      setSubjectId(goal?.subject_id ?? null);
    }
  }, [open, goal]);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (goal) {
        await goals.update.mutateAsync({
          id: goal.id,
          patch: { text: text.trim(), horizon, subject_id: subjectId },
        });
      } else {
        await goals.add.mutateAsync({
          text: text.trim(),
          horizon,
          subject_id: subjectId,
          done: false,
          completed_at: null,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={goal ? t("goals.edit") : t("goals.add")}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Input label={t("goals.text")} value={text} onChangeText={setText} multiline maxLength={300} testID="goal-text" />
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("goals.horizon")}
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {HORIZONS.map((h) => (
              <Chip key={h} label={t(`goals.h${h}`)} active={horizon === h} onPress={() => setHorizon(h)} />
            ))}
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("tasks.subject")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label={t("tasks.noSubject")} active={subjectId === null} onPress={() => setSubjectId(null)} />
            {active.map((s) => (
              <Chip key={s.id} label={s.name} active={subjectId === s.id} activeColor={subjectHex(s.color)} onPress={() => setSubjectId(s.id)} />
            ))}
          </View>
        </View>
        <Button label={t("common.save")} size="lg" block loading={busy} disabled={!text.trim()} onPress={save} testID="goal-save" />
        {goal ? (
          <Button
            label={t("common.delete")}
            variant="danger"
            block
            onPress={async () => {
              await goals.remove.mutateAsync(goal.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

export default function Goals() {
  const { t } = useTranslation();
  const theme = useTheme();
  const goals = useGoals();
  const subjects = useSubjectMap();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const all = goals.query.data ?? [];

  const renderGoal = (goal: Goal, i: number) => {
    const subject = goal.subject_id ? subjects.get(goal.subject_id) : undefined;
    return (
      <Reveal key={goal.id} delay={40 + Math.min(i, 8) * 30}>
        <Slab
          radius={14}
          offset={3}
          onPress={() => {
            setEditing(goal);
            setFormOpen(true);
          }}
          haptic={false}
          accessibilityLabel={goal.text}
          contentStyle={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13 }}
          style={{ marginBottom: 10 }}
        >
          <Pressable
            onPress={() => void goals.toggle(goal)}
            hitSlop={10}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: goal.done }}
            accessibilityLabel={goal.text}
            style={{
              width: 26,
              height: 26,
              borderRadius: 9,
              borderWidth: 2,
              borderColor: theme.border,
              backgroundColor: goal.done ? theme.volt : theme.well,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {goal.done ? <Ionicons name="checkmark" size={16} color={theme.onVolt} /> : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text
              variant="bodyBold"
              style={goal.done ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined}
              numberOfLines={2}
            >
              {goal.text}
            </Text>
            <Text variant="monoSm" muted>
              {subject ? `${subject.name.toUpperCase()} · ` : ""}
              {goal.done && goal.completed_at
                ? t("goals.doneAt", { date: formatDateLong(timestampToLocalISODate(goal.completed_at)) })
                : t(`goals.h${goal.horizon}`)}
            </Text>
          </View>
        </Slab>
      </Reveal>
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t("goals.title")} />
      {all.length === 0 ? (
        <EmptyState
          title={t("goals.empty")}
          body={t("goals.emptySub")}
          doodle="arrow"
          cta={t("goals.add")}
          onCta={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <>
          {HORIZONS.map((h) => {
            const inHorizon = all.filter((g) => g.horizon === h);
            if (!inHorizon.length) return null;
            return (
              <View key={h}>
                <SectionHeader title={t(`goals.h${h}`)} />
                {inHorizon.map(renderGoal)}
              </View>
            );
          })}
          <View style={{ height: 90 }} />
        </>
      )}
      <GoalForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        goal={editing}
      />
      {all.length > 0 ? (
        <FAB
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          label={t("goals.add")}
          aboveDock={false}
        />
      ) : null}
    </Screen>
  );
}
