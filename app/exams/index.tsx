import React, { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";


import {
  Button,
  Chip,
  DateField,
  EmptyState,
  FAB,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  SectionHeader,
  Sheet,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { aiBreakdownSchema, Exam } from "@/db/schemas";
import { runSyllabusBreakdown } from "@/features/ai/api";
import { useExams, useSubjectMap, useSubjects } from "@/hooks/domains";
import { useEntitlement } from "@/hooks/useEntitlement";
import { daysBetween, formatDateLong, todayISO } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

function ExamForm({
  open,
  onClose,
  exam,
}: {
  open: boolean;
  onClose: () => void;
  exam: Exam | null;
}) {
  const { t } = useTranslation();
  const exams = useExams();
  const { active } = useSubjects();
  const [name, setName] = useState("");
  const [board, setBoard] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [syllabusText, setSyllabusText] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(exam?.name ?? "");
      setBoard(exam?.board ?? "");
      setDate(exam?.date ?? null);
      setLocation(exam?.location ?? "");
      setDescription(exam?.description ?? "");
      setSyllabusText(exam?.syllabus_text ?? "");
      setSubjectId(exam?.subject_id ?? null);
    }
  }, [open, exam]);

  const save = async () => {
    if (!name.trim() || !date) return;
    setBusy(true);
    try {
      const patch = {
        name: name.trim(),
        board: board.trim() || null,
        date,
        location: location.trim() || null,
        description: description.trim() || null,
        syllabus_text: syllabusText.trim() || null,
        subject_id: subjectId,
      };
      if (exam) {
        await exams.update.mutateAsync({ id: exam.id, patch });
      } else {
        await exams.add.mutateAsync({
          ...patch,
          syllabus_storage_path: null,
          ai_breakdown_json: null,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={exam ? t("exams.edit") : t("exams.add")}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Input label={t("exams.name")} value={name} onChangeText={setName} maxLength={160} testID="exam-name" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label={t("exams.board")} value={board} onChangeText={setBoard} maxLength={60} containerStyle={{ flex: 1 }} />
          <Input label={t("exams.location")} value={location} onChangeText={setLocation} maxLength={160} containerStyle={{ flex: 1 }} />
        </View>
        <DateField label={t("exams.date")} value={date} onChange={setDate} clearable={false} />
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("tasks.subject")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Chip label={t("tasks.noSubject")} active={subjectId === null} onPress={() => setSubjectId(null)} />
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
        <Input label={t("exams.description")} value={description} onChangeText={setDescription} multiline maxLength={4000} />
        <Input
          label={t("exams.syllabusText")}
          value={syllabusText}
          onChangeText={setSyllabusText}
          multiline
          maxLength={200000}
          hint={t("exams.breakdownEmpty")}
        />
        <Button label={t("common.save")} size="lg" block loading={busy} disabled={!name.trim() || !date} onPress={save} testID="exam-save" />
        {exam ? (
          <Button
            label={t("common.delete")}
            variant="danger"
            block
            onPress={async () => {
              await exams.remove.mutateAsync(exam.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function BreakdownView({ exam }: { exam: Exam }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const parsed = aiBreakdownSchema.safeParse(exam.ai_breakdown_json);
  if (!parsed.success) return null;
  return (
    <View style={{ gap: 10, marginTop: 12 }}>
      {parsed.data.topics.map((topic, i) => (
        <Slab key={i} shadow={false} color={theme.well} radius={12} contentStyle={{ padding: 12, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text variant="bodyBold" style={{ flex: 1 }}>
              {topic.name}
            </Text>
            {topic.estimated_hours > 0 ? (
              <Text variant="monoSm" muted>
                {t("exams.hours", { count: topic.estimated_hours })}
              </Text>
            ) : null}
          </View>
          {topic.subtopics.length ? (
            <Text variant="caption" muted>
              {topic.subtopics.join(" · ")}
            </Text>
          ) : null}
          {topic.key_skills.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {topic.key_skills.map((skill, k) => (
                <View
                  key={k}
                  style={{
                    borderWidth: 1.2,
                    borderColor: theme.border,
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text variant="monoSm" style={{ fontSize: 10 }}>
                    {skill}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Slab>
      ))}
    </View>
  );
}

export default function Exams() {
  const { t } = useTranslation();
  const theme = useTheme();
  const exams = useExams();
  const subjects = useSubjectMap();
  const syllabusAi = useEntitlement("syllabusAi");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [breaking, setBreaking] = useState<string | null>(null);
  const [breakError, setBreakError] = useState<string | null>(null);

  const breakdown = async (exam: Exam) => {
    if (!syllabusAi.requirePro()) return;
    setBreaking(exam.id);
    setBreakError(null);
    try {
      const result = await runSyllabusBreakdown(exam.id);
      await exams.update.mutateAsync({
        id: exam.id,
        patch: { ai_breakdown_json: result },
      });
      setExpanded(exam.id);
    } catch {
      setBreakError(t("exams.breakdownError"));
    } finally {
      setBreaking(null);
    }
  };

  const renderExam = (exam: Exam, i: number) => {
    const subject = exam.subject_id ? subjects.get(exam.subject_id) : undefined;
    const days = daysBetween(todayISO(), exam.date);
    const isPast = days < 0;
    const isExpanded = expanded === exam.id;
    return (
      <Reveal key={exam.id} delay={60 + i * 40}>
        <Slab
          radius={16}
          rotate={i % 2 ? 0.5 : -0.5}
          onPress={() => setExpanded(isExpanded ? null : exam.id)}
          haptic={false}
          accessibilityLabel={exam.name}
          contentStyle={{ padding: 14, gap: 8 }}
          style={{ marginBottom: 12 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {subject ? (
              <View
                style={{
                  width: 10,
                  height: 28,
                  borderRadius: 4,
                  backgroundColor: subjectHex(subject.color),
                  borderWidth: 1.2,
                  borderColor: theme.border,
                }}
              />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text variant="title" numberOfLines={1}>
                {exam.name}
              </Text>
              <Text variant="monoSm" muted>
                {formatDateLong(exam.date)}
                {exam.board ? ` · ${exam.board.toUpperCase()}` : ""}
                {exam.location ? ` · ${exam.location}` : ""}
              </Text>
            </View>
            {!isPast ? (
              <Stamp
                label={days === 0 ? t("exams.today") : t("exams.inDays", { count: days })}
                rotate={3}
                color={days <= 7 ? theme.danger : undefined}
                textColor={days <= 7 ? theme.onDanger : undefined}
              />
            ) : null}
          </View>

          {isExpanded ? (
            <View style={{ gap: 10 }}>
              {exam.description ? (
                <Text variant="body" muted>
                  {exam.description}
                </Text>
              ) : null}
              {exam.ai_breakdown_json ? (
                <BreakdownView exam={exam} />
              ) : (
                <Text variant="caption" faint>
                  {t("exams.breakdownEmpty")}
                </Text>
              )}
              {breakError && breaking === null ? (
                <Text variant="caption" color={theme.danger}>
                  {breakError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  label={breaking === exam.id ? t("exams.breakdownRunning") : t("exams.breakdownRun")}
                  size="sm"
                  icon="sparkles"
                  loading={breaking === exam.id}
                  onPress={() => void breakdown(exam)}
                />
                <Button
                  label={t("common.edit")}
                  variant="secondary"
                  size="sm"
                  onPress={() => {
                    setEditing(exam);
                    setFormOpen(true);
                  }}
                />
              </View>
            </View>
          ) : null}
        </Slab>
      </Reveal>
    );
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t("exams.title")} />
      {exams.upcoming.length === 0 && exams.past.length === 0 ? (
        <EmptyState
          title={t("exams.empty")}
          body={t("exams.emptySub")}
          doodle="burst"
          cta={t("exams.add")}
          onCta={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <>
          {exams.upcoming.map(renderExam)}
          {exams.past.length ? (
            <>
              <SectionHeader title={t("exams.past")} />
              {exams.past.map(renderExam)}
            </>
          ) : null}
          <View style={{ height: 90 }} />
        </>
      )}
      <ExamForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        exam={editing}
      />
      {exams.upcoming.length || exams.past.length ? (
        <FAB
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          label={t("exams.add")}
          aboveDock={false}
        />
      ) : null}
    </Screen>
  );
}
