import React, { useState } from "react";
import { Alert, Platform, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  Input,
  Screen,
  ScreenHeader,
  SectionHeader,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { TrendChart } from "@/components/TrendChart";
import { fonts, space, subjectHex } from "@/constants/theme";
import { SubjectFormSheet } from "@/features/subjects/SubjectFormSheet";
import {
  usePapers,
  useSubjects,
  useTasks,
  useTimeline,
  useTopicConfidence,
} from "@/hooks/domains";
import { useTheme } from "@/providers/theme";

function confirmDelete(title: string, body: string, onYes: () => void) {
  if (Platform.OS === "web") {
     
    if (globalThis.confirm?.(`${title}\n${body}`)) onYes();
  } else {
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onYes },
    ]);
  }
}

function TopicRow({
  topic,
  confidence,
  onChange,
  onRemove,
}: {
  topic: string;
  confidence: number;
  onChange: (next: number) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const step = 10;
  return (
    <Slab shadow={false} color={theme.well} radius={12} contentStyle={{ padding: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
          {topic}
        </Text>
        <Text variant="monoSm" muted>
          {confidence}%
        </Text>
        <Pressable onPress={onRemove} hitSlop={8} accessibilityLabel={`Remove ${topic}`}>
          <Ionicons name="close" size={16} color={theme.inkFaint} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <IconButton
          icon="remove"
          size={32}
          label={`Lower confidence for ${topic}`}
          onPress={() => onChange(Math.max(0, confidence - step))}
        />
        <View
          style={{
            flex: 1,
            height: 14,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${confidence}%`,
              height: "100%",
              backgroundColor:
                confidence >= 70 ? theme.volt : confidence >= 40 ? theme.warn : theme.danger,
            }}
          />
        </View>
        <IconButton
          icon="add"
          size={32}
          label={`Raise confidence for ${topic}`}
          onPress={() => onChange(Math.min(100, confidence + step))}
        />
      </View>
    </Slab>
  );
}

export default function SubjectDetail() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const subjects = useSubjects();
  const subject = (subjects.query.data ?? []).find((s) => s.id === id);
  const confidence = useTopicConfidence(id ?? "");
  const { papers } = usePapers(id);
  const tasks = useTasks();
  const timeline = useTimeline(id);
  const [editOpen, setEditOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");

  if (!subject) {
    return (
      <Screen>
        <ScreenHeader title={t("subjects.title")} />
        <EmptyState title="404" body={t("common.error")} doodle="burst" />
      </Screen>
    );
  }

  const scored = papers.filter((p) => p.scored != null && p.total != null && p.total > 0);
  const subjectTasks = tasks.open.filter((task) => task.subject_id === subject.id).slice(0, 5);

  const addTopic = async () => {
    const name = newTopic.trim();
    if (!name) return;
    setNewTopic("");
    await confidence.upsert(name, 50);
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title={subject.name}
        eyebrow={subject.board ?? undefined}
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <IconButton icon="pencil" label={t("common.edit")} onPress={() => setEditOpen(true)} />
            <IconButton
              icon="archive"
              label={t("subjects.archive")}
              onPress={async () => {
                await subjects.update.mutateAsync({
                  id: subject.id,
                  patch: { archived_at: new Date().toISOString() },
                });
                router.back();
              }}
            />
          </View>
        }
      />

      {/* identity band */}
      <Slab radius={18} contentStyle={{ overflow: "hidden" }}>
        <View
          style={{
            backgroundColor: subjectHex(subject.color),
            paddingHorizontal: 16,
            paddingVertical: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Text
            style={{ fontFamily: fonts.displayBlack, fontSize: 20, color: "#16140F", flex: 1 }}
            numberOfLines={1}
          >
            {subject.name.toUpperCase()}
          </Text>
          {subject.target_grade ? (
            <Stamp label={`TARGET ${subject.target_grade}`} color={theme.surface} textColor={theme.ink} rotate={3} />
          ) : null}
        </View>
      </Slab>

      {/* papers trend */}
      <SectionHeader
        title={t("subjects.papers")}
        action={t("home.seeAll")}
        onAction={() => router.push("/papers")}
      />
      {scored.length === 0 ? (
        <Slab shadow={false} color={theme.well} contentStyle={{ padding: 16 }}>
          <Text variant="bodyMedium" muted>
            {t("papers.emptySub")}
          </Text>
        </Slab>
      ) : (
        <Slab radius={16} contentStyle={{ padding: 12 }}>
          <TrendChart
            color={subjectHex(subject.color)}
            points={scored.map((p) => ({
              value: (p.scored! / p.total!) * 100,
              label: p.paper_number ?? (p.year ? String(p.year) : undefined),
            }))}
          />
        </Slab>
      )}

      {/* topic confidence */}
      <SectionHeader title={t("subjects.topics")} />
      <View style={{ gap: 10 }}>
        {confidence.topics.length === 0 ? (
          <Text variant="caption" muted>
            {t("subjects.topicsEmpty")}
          </Text>
        ) : (
          confidence.topics.map((row) => (
            <TopicRow
              key={row.id}
              topic={row.topic}
              confidence={row.confidence}
              onChange={(next) => void confidence.upsert(row.topic, next)}
              onRemove={() => void confidence.remove.mutateAsync(row.id)}
            />
          ))
        )}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Input
            value={newTopic}
            onChangeText={setNewTopic}
            placeholder={t("subjects.topicName")}
            containerStyle={{ flex: 1 }}
            onSubmitEditing={addTopic}
            maxLength={160}
          />
          <Button label={t("subjects.topicAdd")} variant="secondary" onPress={addTopic} />
        </View>
      </View>

      {/* open tasks for this subject */}
      {subjectTasks.length > 0 ? (
        <>
          <SectionHeader
            title={t("subjects.tasksFor")}
            action={t("home.seeAll")}
            onAction={() => router.push("/(tabs)/tasks")}
          />
          <View style={{ gap: 8 }}>
            {subjectTasks.map((task) => (
              <Slab
                key={task.id}
                shadow={false}
                color={theme.well}
                radius={12}
                contentStyle={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Ionicons name="checkbox-outline" size={14} color={theme.inkMuted} />
                <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>
                  {task.text}
                </Text>
                {task.due_date ? (
                  <Text variant="monoSm" muted>
                    {task.due_date.slice(5)}
                  </Text>
                ) : null}
              </Slab>
            ))}
          </View>
        </>
      ) : null}

      {/* upcoming for this subject */}
      {timeline.items.length > 0 ? (
        <>
          <SectionHeader title={t("subjects.deadlinesFor")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {timeline.items.slice(0, 6).map((item, i) => (
              <Chip
                key={i}
                label={`${item.date.slice(5)} · ${
                  item.kind === "task"
                    ? item.task.text
                    : item.kind === "deadline"
                      ? item.deadline.title
                      : item.kind === "exam"
                        ? item.exam.name
                        : item.event.title
                }`}
              />
            ))}
          </View>
        </>
      ) : null}

      {/* danger zone */}
      <View style={{ marginTop: space.jumbo, gap: 10 }}>
        <Button
          label={t("subjects.delete")}
          variant="danger"
          block
          onPress={() =>
            confirmDelete(t("common.confirmDeleteTitle"), t("common.confirmDeleteBody"), async () => {
              await subjects.remove.mutateAsync(subject.id);
              router.back();
            })
          }
        />
      </View>

      <SubjectFormSheet open={editOpen} onClose={() => setEditOpen(false)} subject={subject} />
    </Screen>
  );
}
