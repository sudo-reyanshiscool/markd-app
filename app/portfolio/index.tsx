import React, { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  Button,
  Chip,
  EmptyState,
  FAB,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  Sheet,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { PortfolioEntry } from "@/db/schemas";
import { usePortfolio, useSubjectMap, useSubjects } from "@/hooks/domains";
import { useEntitlement } from "@/hooks/useEntitlement";
import { formatDateLong, timestampToLocalISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

const TYPES = ["project", "achievement", "competition", "leadership"] as const;
type EntryType = (typeof TYPES)[number];

const TYPE_COLORS: Record<EntryType, string> = {
  project: "#6FC2FF",
  achievement: "#C8FF1F",
  competition: "#FF9A3D",
  leadership: "#C0A8FF",
};

function entriesToCSV(entries: PortfolioEntry[]): string {
  const esc = (v: string | null) => `"${(v ?? "").replaceAll('"', '""')}"`;
  const rows = entries.map((e) =>
    [esc(e.title), e.type, esc(e.description), esc(e.tags.join(";")), e.created_at].join(","),
  );
  return ["title,type,description,tags,created_at", ...rows].join("\n");
}

function EntryForm({ open, onClose, entry }: { open: boolean; onClose: () => void; entry: PortfolioEntry | null }) {
  const { t } = useTranslation();
  const portfolio = usePortfolio();
  const { active } = useSubjects();
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EntryType>("project");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle(entry?.title ?? "");
      setType(entry?.type ?? "project");
      setDescription(entry?.description ?? "");
      setTags(entry?.tags.join(", ") ?? "");
      setSubjectId(entry?.subject_id ?? null);
    }
  }, [open, entry]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const patch = {
        title: title.trim(),
        type,
        description: description.trim() || null,
        tags: tags
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 12),
        subject_id: subjectId,
      };
      if (entry) await portfolio.update.mutateAsync({ id: entry.id, patch });
      else await portfolio.add.mutateAsync(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={entry ? t("portfolio.edit") : t("portfolio.add")}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Input label={t("portfolio.entryTitle")} value={title} onChangeText={setTitle} maxLength={160} testID="portfolio-title" />
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("portfolio.type")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {TYPES.map((tp) => (
              <Chip key={tp} label={t(`portfolio.${tp}`)} active={type === tp} activeColor={TYPE_COLORS[tp]} onPress={() => setType(tp)} />
            ))}
          </View>
        </View>
        <Input label={t("portfolio.description")} value={description} onChangeText={setDescription} multiline maxLength={4000} />
        <Input label={t("portfolio.tags")} value={tags} onChangeText={setTags} hint={t("portfolio.tagsHint")} />
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
        <Button label={t("common.save")} size="lg" block loading={busy} disabled={!title.trim()} onPress={save} testID="portfolio-save" />
        {entry ? (
          <Button
            label={t("common.delete")}
            variant="danger"
            block
            onPress={async () => {
              await portfolio.remove.mutateAsync(entry.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

export default function Portfolio() {
  const { t } = useTranslation();
  const theme = useTheme();
  const portfolio = usePortfolio();
  const subjects = useSubjectMap();
  const exports = useEntitlement("exports");
  const [filter, setFilter] = useState<EntryType | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PortfolioEntry | null>(null);

  const all = useMemo(() => portfolio.query.data ?? [], [portfolio.query.data]);
  const entries = useMemo(
    () => (filter ? all.filter((e) => e.type === filter) : all),
    [all, filter],
  );

  const exportCSV = () => {
    if (!exports.requirePro()) return;
    const csv = entriesToCSV(all);
    if (Platform.OS === "web") {
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "markd-portfolio.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      void (async () => {
        const FileSystem = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
        const Sharing = require("expo-sharing") as typeof import("expo-sharing");
        const path = `${FileSystem.cacheDirectory}markd-portfolio.csv`;
        await FileSystem.writeAsStringAsync(path, csv);
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      })();
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader
        title={t("portfolio.title")}
        right={
          all.length ? (
            <Button label={t("portfolio.export")} variant="secondary" size="sm" icon="download" onPress={exportCSV} />
          ) : undefined
        }
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        <Chip label={t("timeline.all")} active={filter === null} onPress={() => setFilter(null)} />
        {TYPES.map((tp) => (
          <Chip key={tp} label={t(`portfolio.${tp}`)} active={filter === tp} activeColor={TYPE_COLORS[tp]} onPress={() => setFilter(filter === tp ? null : tp)} />
        ))}
      </View>

      {entries.length === 0 ? (
        <EmptyState
          title={t("portfolio.empty")}
          body={t("portfolio.emptySub")}
          doodle="star"
          cta={t("portfolio.add")}
          onCta={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <View style={{ gap: 12, paddingBottom: 90 }}>
          {entries.map((entry, i) => {
            const subject = entry.subject_id ? subjects.get(entry.subject_id) : undefined;
            return (
              <Reveal key={entry.id} delay={40 + Math.min(i, 8) * 30}>
                <Slab
                  radius={16}
                  rotate={i % 2 ? 0.6 : -0.6}
                  onPress={() => {
                    setEditing(entry);
                    setFormOpen(true);
                  }}
                  haptic={false}
                  accessibilityLabel={entry.title}
                  contentStyle={{ padding: 14, gap: 8 }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Stamp label={t(`portfolio.${entry.type}`)} size="sm" color={TYPE_COLORS[entry.type]} textColor="#16140F" rotate={-3} />
                    {subject ? (
                      <Text variant="monoSm" muted>
                        {subject.name.toUpperCase()}
                      </Text>
                    ) : null}
                    <Text variant="monoSm" faint style={{ marginLeft: "auto" }}>
                      {formatDateLong(timestampToLocalISODate(entry.created_at))}
                    </Text>
                  </View>
                  <Text variant="title">{entry.title}</Text>
                  {entry.description ? (
                    <Text variant="body" muted numberOfLines={3}>
                      {entry.description}
                    </Text>
                  ) : null}
                  {entry.tags.length ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                      {entry.tags.map((tag) => (
                        <View key={tag} style={{ borderWidth: 1.2, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text variant="monoSm" style={{ fontSize: 10 }}>
                            #{tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Slab>
              </Reveal>
            );
          })}
        </View>
      )}

      <EntryForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        entry={editing}
      />
      {entries.length > 0 ? (
        <FAB
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          label={t("portfolio.add")}
          aboveDock={false}
        />
      ) : null}
    </Screen>
  );
}
