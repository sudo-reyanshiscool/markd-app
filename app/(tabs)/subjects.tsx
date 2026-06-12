import React, { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Chip,
  EmptyState,
  FAB,
  Reveal,
  Screen,
  SectionHeader,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { fonts, space, subjectHex } from "@/constants/theme";
import { Subject } from "@/db/schemas";
import { SubjectDragList, ROW_HEIGHT } from "@/features/subjects/DragList";
import { SubjectFormSheet } from "@/features/subjects/SubjectFormSheet";
import { useSubjectHealthMap, useSubjects } from "@/hooks/domains";
import { useQuotaGate } from "@/hooks/useEntitlement";
import { useTheme } from "@/providers/theme";

export default function Subjects() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const subjects = useSubjects();
  const healthMap = useSubjectHealthMap();
  const quota = useQuotaGate();
  const [formOpen, setFormOpen] = useState(false);

  const renderCard = (subject: Subject, dragHandle: React.ReactNode) => {
    const health = healthMap.get(subject.id);
    const pips =
      health?.score == null ? 0 : Math.max(1, Math.round(health.score / 20));
    return (
      <Slab
        onPress={() => router.push(`/subject/${subject.id}`)}
        radius={16}
        offset={4}
        haptic={false}
        accessibilityLabel={subject.name}
        style={{ height: ROW_HEIGHT }}
        contentStyle={{
          flexDirection: "row",
          alignItems: "center",
          height: ROW_HEIGHT - 4,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: 18,
            alignSelf: "stretch",
            backgroundColor: subjectHex(subject.color),
            borderRightWidth: 2,
            borderRightColor: theme.border,
          }}
        />
        <View style={{ flex: 1, paddingHorizontal: 14, gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{ fontFamily: fonts.display, fontSize: 16, color: theme.ink, flex: 1 }}
              numberOfLines={1}
            >
              {subject.name}
            </Text>
            {subject.target_grade ? (
              <Stamp label={subject.target_grade} size="sm" rotate={3} />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 3, width: 90 }}>
              {Array.from({ length: 5 }, (_, p) => (
                <View
                  key={p}
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 3,
                    borderWidth: 1.2,
                    borderColor: theme.border,
                    backgroundColor: p < pips ? theme.volt : theme.well,
                  }}
                />
              ))}
            </View>
            {subject.board ? (
              <Text variant="monoSm" muted numberOfLines={1}>
                {subject.board.toUpperCase()}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={{ paddingRight: 12 }}>{dragHandle}</View>
      </Slab>
    );
  };

  return (
    <Screen scroll dock>
      <Reveal delay={20}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text variant="displayXL">{t("subjects.title")}</Text>
          <Text variant="monoSm" muted>
            {subjects.active.length}
            {Number.isFinite(quota.plan === "free" ? 3 : Infinity) ? " / 3" : ""}
          </Text>
        </View>
        <Text variant="caption" faint style={{ marginTop: 4 }}>
          {t("subjects.dragHint")}
        </Text>
      </Reveal>

      <Reveal delay={100} style={{ marginTop: space.xl }}>
        {subjects.active.length === 0 ? (
          <EmptyState
            title={t("subjects.empty")}
            body={t("subjects.emptySub")}
            doodle="star"
            cta={t("subjects.add")}
            onCta={() => {
              if (quota.gateSubject()) setFormOpen(true);
            }}
          />
        ) : (
          <SubjectDragList
            subjects={subjects.active}
            onReorder={(ids) => void subjects.reorder(ids)}
            renderCard={renderCard}
          />
        )}
      </Reveal>

      {subjects.archived.length > 0 ? (
        <>
          <SectionHeader title={t("subjects.archived")} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {subjects.archived.map((s) => (
              <Chip
                key={s.id}
                label={s.name}
                icon="archive"
                onPress={() =>
                  void subjects.update.mutateAsync({
                    id: s.id,
                    patch: { archived_at: null },
                  })
                }
              />
            ))}
          </View>
        </>
      ) : null}

      <SubjectFormSheet open={formOpen} onClose={() => setFormOpen(false)} subject={null} />
      {subjects.active.length > 0 ? (
        <FAB
          onPress={() => {
            if (quota.gateSubject()) setFormOpen(true);
          }}
          label={t("subjects.add")}
        />
      ) : null}
    </Screen>
  );
}
