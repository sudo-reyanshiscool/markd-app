import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  Chip,
  EmptyState,
  Reveal,
  Screen,
  ScreenHeader,
  Slab,
  Text,
} from "@/components/ui";
import { subjectHex } from "@/constants/theme";
import { runSyllabusBreakdown } from "@/features/ai/api";
import { useSubjectMap, useSubjects } from "@/hooks/domains";
import { useEntityList, useEntityMutations } from "@/hooks/useEntities";
import { useEntitlement } from "@/hooks/useEntitlement";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";
import { formatDateLong, timestampToLocalISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

export default function Syllabus() {
  const { t } = useTranslation();
  const theme = useTheme();
  const mode = useSessionStore((s) => s.mode);
  const userId = useSessionStore((s) => s.userId);
  const specs = useEntityList("subject_specs");
  const specMutations = useEntityMutations("subject_specs");
  const subjects = useSubjectMap();
  const { active } = useSubjects();
  const syllabusAi = useEntitlement("syllabusAi");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [breaking, setBreaking] = useState<string | null>(null);
  const [pickedSubject, setPickedSubject] = useState<string | null>(null);

  const canUpload = mode === "authed" && supabase;

  const upload = async () => {
    if (!canUpload || !userId) return;
    setError(null);
    const DocumentPicker = require("expo-document-picker") as typeof import("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/plain"],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 20 * 1024 * 1024) {
      setError(t("syllabus.uploadFailed"));
      return;
    }
    setUploading(true);
    try {
      const safeName = asset.name.replaceAll(/[^\w.\-]/g, "_");
      const path = `${userId}/${Date.now()}-${safeName}`;
      const body =
        Platform.OS === "web"
          ? await fetch(asset.uri).then((r) => r.blob())
          : ((await fetch(asset.uri).then((r) => r.arrayBuffer())) as ArrayBuffer);
      const { error: upErr } = await supabase!.storage
        .from("syllabi")
        .upload(path, body, { contentType: asset.mimeType ?? "application/pdf" });
      if (upErr) throw upErr;
      await specMutations.add.mutateAsync({
        subject_id: pickedSubject ?? active[0]?.id ?? "",
        year: null,
        storage_path: path,
        file_name: asset.name,
        mime: asset.mimeType ?? "application/pdf",
        size_bytes: asset.size ?? 0,
      });
    } catch {
      setError(t("syllabus.uploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const view = async (path: string) => {
    if (!supabase) return;
    const { data } = await supabase.storage.from("syllabi").createSignedUrl(path, 600);
    if (!data?.signedUrl) return;
    if (Platform.OS === "web") {
      globalThis.open?.(data.signedUrl, "_blank");
    } else {
      const WebBrowser = require("expo-web-browser") as typeof import("expo-web-browser");
      await WebBrowser.openBrowserAsync(data.signedUrl);
    }
  };

  const breakdown = async (specId: string) => {
    if (!syllabusAi.requirePro()) return;
    setBreaking(specId);
    try {
      await runSyllabusBreakdown(undefined, specId);
    } catch {
      setError(t("exams.breakdownError"));
    } finally {
      setBreaking(null);
    }
  };

  const rows = specs.data ?? [];

  return (
    <Screen scroll>
      <ScreenHeader title={t("syllabus.title")} />

      {!canUpload ? (
        <Slab shadow={false} color={theme.well} contentStyle={{ padding: 14 }} style={{ marginBottom: 16 }}>
          <Text variant="bodyMedium" muted>
            {t("syllabus.guestBlocked")}
          </Text>
        </Slab>
      ) : (
        <View style={{ gap: 10, marginBottom: 16 }}>
          {active.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {active.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  active={pickedSubject === s.id}
                  activeColor={subjectHex(s.color)}
                  onPress={() => setPickedSubject(pickedSubject === s.id ? null : s.id)}
                />
              ))}
            </View>
          ) : null}
          <Button
            label={t("syllabus.upload")}
            icon="cloud-upload"
            size="lg"
            block
            loading={uploading}
            onPress={() => void upload()}
            testID="syllabus-upload"
          />
          <Text variant="caption" faint>
            {t("syllabus.uploadHint")}
          </Text>
          {error ? (
            <Text variant="caption" color={theme.danger}>
              {error}
            </Text>
          ) : null}
        </View>
      )}

      {rows.length === 0 ? (
        <EmptyState title={t("syllabus.empty")} body={t("syllabus.emptySub")} doodle="squiggle" />
      ) : (
        <View style={{ gap: 10, paddingBottom: 40 }}>
          {rows.map((spec, i) => {
            const subject = subjects.get(spec.subject_id);
            return (
              <Reveal key={spec.id} delay={40 + Math.min(i, 8) * 30}>
                <Slab radius={14} offset={3} contentStyle={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13 }}>
                  <View
                    style={{
                      width: 42,
                      height: 50,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: theme.border,
                      backgroundColor: subject ? subjectHex(subject.color) : theme.well,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={spec.mime.includes("pdf") ? "document" : "document-text"}
                      size={20}
                      color="#16140F"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyBold" numberOfLines={1}>
                      {spec.file_name}
                    </Text>
                    <Text variant="monoSm" muted>
                      {[
                        subject?.name.toUpperCase(),
                        `${Math.max(1, Math.round(spec.size_bytes / 1024))}KB`,
                        t("syllabus.uploaded", {
                          date: formatDateLong(timestampToLocalISODate(spec.created_at)),
                        }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Button label={t("syllabus.view")} variant="secondary" size="sm" onPress={() => void view(spec.storage_path)} />
                    <Button
                      label="AI"
                      size="sm"
                      icon="sparkles"
                      loading={breaking === spec.id}
                      onPress={() => void breakdown(spec.id)}
                    />
                  </View>
                </Slab>
              </Reveal>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
