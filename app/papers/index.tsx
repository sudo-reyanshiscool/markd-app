import React, { useMemo, useState } from "react";
import { Linking, ScrollView, View } from "react-native";
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
  Text,
} from "@/components/ui";
import { TrendChart } from "@/components/TrendChart";
import { fonts, subjectHex } from "@/constants/theme";
import { Paper } from "@/db/schemas";
import { usePapers, useSubjectMap, useSubjects } from "@/hooks/domains";
import { formatDateLong } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

const RESOURCES: { name: string; url: string }[] = [
  { name: "AQA", url: "https://www.aqa.org.uk/find-past-papers-and-mark-schemes" },
  { name: "Edexcel", url: "https://qualifications.pearson.com/en/support/support-topics/exams/past-papers.html" },
  { name: "OCR", url: "https://www.ocr.org.uk/qualifications/past-paper-finder/" },
  { name: "CIE", url: "https://www.cambridgeinternational.org/programmes-and-qualifications/" },
  { name: "IB", url: "https://www.ibo.org/programmes/diploma-programme/assessment-and-exams/" },
  { name: "Save My Exams", url: "https://www.savemyexams.com" },
  { name: "Physics & Maths Tutor", url: "https://www.physicsandmathstutor.com" },
  { name: "Revision World", url: "https://revisionworld.com" },
];

function PaperForm({
  open,
  onClose,
  paper,
}: {
  open: boolean;
  onClose: () => void;
  paper: Paper | null;
}) {
  const { t } = useTranslation();
  const papers = usePapers();
  const { active } = useSubjects();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("");
  const [number, setNumber] = useState("");
  const [scored, setScored] = useState("");
  const [total, setTotal] = useState("");
  const [takenOn, setTakenOn] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(paper?.title ?? "");
      setYear(paper?.year ? String(paper.year) : "");
      setNumber(paper?.paper_number ?? "");
      setScored(paper?.scored != null ? String(paper.scored) : "");
      setTotal(paper?.total != null ? String(paper.total) : "");
      setTakenOn(paper?.taken_on ?? null);
      setNotes(paper?.notes ?? "");
      setSubjectId(paper?.subject_id ?? null);
    }
  }, [open, paper]);

  const save = async () => {
    setBusy(true);
    try {
      const patch = {
        title: title.trim() || null,
        year: year ? Number(year) : null,
        paper_number: number.trim() || null,
        scored: scored ? Number(scored) : null,
        total: total ? Number(total) : null,
        taken_on: takenOn,
        notes: notes.trim() || null,
        subject_id: subjectId,
      };
      if (paper) await papers.update.mutateAsync({ id: paper.id, patch });
      else await papers.add.mutateAsync(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={paper ? t("papers.edit") : t("papers.add")}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Input label={t("papers.paperTitle")} value={title} onChangeText={setTitle} maxLength={160} testID="paper-title" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label={t("papers.year")} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} containerStyle={{ flex: 1 }} />
          <Input label={t("papers.number")} value={number} onChangeText={setNumber} maxLength={40} containerStyle={{ flex: 1 }} placeholder="Paper 2" />
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label={t("papers.scored")} value={scored} onChangeText={setScored} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} testID="paper-scored" />
          <Input label={t("papers.total")} value={total} onChangeText={setTotal} keyboardType="decimal-pad" containerStyle={{ flex: 1 }} testID="paper-total" />
        </View>
        <DateField label={t("papers.takenOn")} value={takenOn} onChange={setTakenOn} />
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
        <Input label={t("papers.notes")} value={notes} onChangeText={setNotes} multiline maxLength={2000} />
        <Button label={t("common.save")} size="lg" block loading={busy} onPress={save} testID="paper-save" />
        {paper ? (
          <Button
            label={t("common.delete")}
            variant="danger"
            block
            onPress={async () => {
              await papers.remove.mutateAsync(paper.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

export default function Papers() {
  const { t } = useTranslation();
  const theme = useTheme();
  const subjects = useSubjectMap();
  const { active } = useSubjects();
  const [filter, setFilter] = useState<string | null>(null);
  const { papers } = usePapers(filter);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Paper | null>(null);

  const scored = useMemo(
    () => papers.filter((p) => p.scored != null && p.total != null && p.total > 0),
    [papers],
  );

  return (
    <Screen scroll>
      <ScreenHeader title={t("papers.title")} />

      {active.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
          <Chip label={t("timeline.all")} active={filter === null} onPress={() => setFilter(null)} />
          {active.map((s) => (
            <Chip key={s.id} label={s.name} active={filter === s.id} activeColor={subjectHex(s.color)} onPress={() => setFilter(filter === s.id ? null : s.id)} />
          ))}
        </ScrollView>
      ) : null}

      {papers.length === 0 ? (
        <EmptyState
          title={t("papers.empty")}
          body={t("papers.emptySub")}
          doodle="star"
          cta={t("papers.add")}
          onCta={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <>
          {scored.length > 0 ? (
            <Reveal>
              <Slab radius={16} contentStyle={{ padding: 12 }} style={{ marginBottom: 6 }}>
                <Text variant="label" muted style={{ marginBottom: 6 }}>
                  {t("papers.trend")}
                </Text>
                <TrendChart
                  points={scored.map((p) => ({
                    value: (p.scored! / p.total!) * 100,
                    label: p.paper_number ?? (p.year ? String(p.year) : undefined),
                  }))}
                />
              </Slab>
            </Reveal>
          ) : null}

          <View style={{ gap: 10, marginTop: 12 }}>
            {papers.map((paper, i) => {
              const subject = paper.subject_id ? subjects.get(paper.subject_id) : undefined;
              const pct =
                paper.scored != null && paper.total != null && paper.total > 0
                  ? Math.round((paper.scored / paper.total) * 100)
                  : null;
              return (
                <Reveal key={paper.id} delay={40 + Math.min(i, 8) * 30}>
                  <Slab
                    radius={14}
                    offset={3}
                    onPress={() => {
                      setEditing(paper);
                      setFormOpen(true);
                    }}
                    haptic={false}
                    accessibilityLabel={paper.title ?? "Paper"}
                    contentStyle={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13 }}
                  >
                    <View
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 12,
                        borderWidth: 2,
                        borderColor: theme.border,
                        backgroundColor:
                          pct == null ? theme.well : pct >= 70 ? theme.volt : pct >= 50 ? theme.warn : theme.danger,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: fonts.monoBold, fontSize: 14, color: "#16140F" }}>
                        {pct == null ? "—" : `${pct}%`}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyBold" numberOfLines={1}>
                        {paper.title || `${subject?.name ?? "Paper"} ${paper.paper_number ?? ""}`.trim()}
                      </Text>
                      <Text variant="monoSm" muted>
                        {[
                          subject?.name.toUpperCase(),
                          paper.year ? String(paper.year) : null,
                          paper.paper_number,
                          paper.taken_on ? formatDateLong(paper.taken_on) : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    {paper.scored != null && paper.total != null ? (
                      <Text variant="mono" muted>
                        {paper.scored}/{paper.total}
                      </Text>
                    ) : null}
                  </Slab>
                </Reveal>
              );
            })}
          </View>
        </>
      )}

      <SectionHeader title={t("papers.resources")} />
      <Text variant="caption" muted style={{ marginBottom: 10 }}>
        {t("papers.resourcesSub")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 90 }}>
        {RESOURCES.map((r) => (
          <Chip key={r.name} label={r.name} icon="open-outline" onPress={() => void Linking.openURL(r.url)} />
        ))}
      </View>

      <PaperForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        paper={editing}
      />
      {papers.length > 0 ? (
        <FAB
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          label={t("papers.add")}
          aboveDock={false}
        />
      ) : null}
    </Screen>
  );
}
