import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import { Input, Slab, Text } from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { useSubjects, useTasks } from "@/hooks/domains";
import { useQuotaGate } from "@/hooks/useEntitlement";
import { tap } from "@/lib/haptics";
import { formatDateShort, formatMinutes } from "@/utils/dates";
import { parseTaskInput } from "@/utils/taskParser";
import { useTheme } from "@/providers/theme";

function PreviewChip({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color?: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: color ?? theme.well,
        borderWidth: 1.5,
        borderColor: theme.border,
        borderRadius: 999,
        paddingHorizontal: 9,
        height: 26,
      }}
    >
      <Ionicons name={icon} size={11} color="#16140F" style={color ? undefined : { opacity: 0.6 }} />
      <Text variant="monoSm" color={color ? "#16140F" : theme.inkMuted}>
        {label}
      </Text>
    </View>
  );
}

/** Natural-language quick-add with a live parse preview (spec §7.3). */
export function QuickAdd() {
  const { t } = useTranslation();
  const theme = useTheme();
  const [value, setValue] = useState("");
  const { active } = useSubjects();
  const tasks = useTasks();
  const quota = useQuotaGate();

  const parsed = useMemo(
    () =>
      value.trim()
        ? parseTaskInput(
            value,
            active.map((s) => ({ id: s.id, name: s.name })),
          )
        : null,
    [value, active],
  );
  const subject = parsed?.subjectId
    ? active.find((s) => s.id === parsed.subjectId)
    : null;

  const submit = async () => {
    if (!parsed || !parsed.text) return;
    if (!quota.gateTask()) return;
    tap();
    setValue("");
    await tasks.add.mutateAsync({
      text: parsed.text,
      subject_id: parsed.subjectId,
      priority: parsed.priority ?? 3,
      estimate_minutes: parsed.estimateMinutes,
      due_date: parsed.dueDate,
      topic: null,
      recurrence: null,
      done: false,
      snoozed_until: null,
      completed_at: null,
    });
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <Input
          value={value}
          onChangeText={setValue}
          placeholder={t("tasks.quickAddPlaceholder")}
          onSubmitEditing={submit}
          returnKeyType="done"
          containerStyle={{ flex: 1 }}
          testID="quick-add"
          accessibilityLabel={t("tasks.add")}
        />
        <Slab
          color={theme.volt}
          onPress={submit}
          disabled={!parsed?.text}
          radius={14}
          accessibilityLabel={t("tasks.add")}
          contentStyle={{
            width: 50,
            height: 50,
            alignItems: "center",
            justifyContent: "center",
          }}
          testID="quick-add-submit"
        >
          <Ionicons name="arrow-up" size={22} color={theme.onVolt} />
        </Slab>
      </View>

      {parsed && (parsed.subjectId || parsed.dueDate || parsed.estimateMinutes || parsed.priority || parsed.dueTimeMinutes) ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {subject ? (
            <PreviewChip
              icon="book"
              label={subject.name.toUpperCase()}
              color={subjectHex(subject.color)}
            />
          ) : null}
          {parsed.dueDate ? (
            <PreviewChip icon="calendar" label={formatDateShort(parsed.dueDate)} />
          ) : null}
          {parsed.dueTimeMinutes != null ? (
            <PreviewChip icon="time" label={formatMinutes(parsed.dueTimeMinutes)} />
          ) : null}
          {parsed.estimateMinutes ? (
            <PreviewChip icon="hourglass" label={`~${parsed.estimateMinutes}M`} />
          ) : null}
          {parsed.priority ? (
            <PreviewChip icon="flag" label={`P${parsed.priority}`} />
          ) : null}
        </View>
      ) : (
        <Text variant="caption" faint>
          {t("tasks.quickAddHint")}
        </Text>
      )}
    </View>
  );
}
