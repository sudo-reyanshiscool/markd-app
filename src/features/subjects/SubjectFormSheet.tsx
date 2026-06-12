import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Input, Sheet, Text } from "@/components/ui";
import { ColorPicker } from "@/components/ColorPicker";
import { Subject } from "@/db/schemas";
import { useSubjects } from "@/hooks/domains";

export function SubjectFormSheet({
  open,
  onClose,
  subject,
}: {
  open: boolean;
  onClose: () => void;
  subject: Subject | null;
}) {
  const { t } = useTranslation();
  const subjects = useSubjects();
  const [name, setName] = useState("");
  const [board, setBoard] = useState("");
  const [target, setTarget] = useState("");
  const [color, setColor] = useState("volt");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(subject?.name ?? "");
      setBoard(subject?.board ?? "");
      setTarget(subject?.target_grade ?? "");
      setColor(subject?.color ?? "volt");
    }
  }, [open, subject]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (subject) {
        await subjects.update.mutateAsync({
          id: subject.id,
          patch: {
            name: name.trim(),
            board: board.trim() || null,
            target_grade: target.trim() || null,
            color,
          },
        });
      } else {
        await subjects.add.mutateAsync({
          name: name.trim(),
          board: board.trim() || null,
          target_grade: target.trim() || null,
          color,
          position: subjects.active.length,
          archived_at: null,
        });
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={subject ? t("subjects.edit") : t("subjects.add")}
    >
      <View style={{ gap: 18, paddingBottom: 8 }}>
        <Input
          label={t("subjects.name")}
          value={name}
          onChangeText={setName}
          maxLength={80}
          autoCapitalize="words"
          testID="subject-name"
        />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input
            label={t("subjects.board")}
            value={board}
            onChangeText={setBoard}
            maxLength={60}
            containerStyle={{ flex: 1 }}
            placeholder="AQA, Edexcel…"
          />
          <Input
            label={t("subjects.targetGrade")}
            value={target}
            onChangeText={setTarget}
            maxLength={12}
            containerStyle={{ width: 120 }}
            placeholder="9, A*, 7…"
          />
        </View>
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("subjects.colour")}
          </Text>
          <ColorPicker value={color} onChange={setColor} />
        </View>
        <Button
          label={t("common.save")}
          size="lg"
          block
          loading={busy}
          disabled={!name.trim()}
          onPress={save}
          testID="subject-save"
        />
      </View>
    </Sheet>
  );
}
