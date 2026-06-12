import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import Constants from "expo-constants";

import {
  Button,
  Chip,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  SectionHeader,
  Sheet,
  Slab,
  Stamp,
  Text,
  Toggle,
} from "@/components/ui";
import { updateProfile } from "@/features/auth/api";
import { signOutEverywhere } from "@/features/auth/actions";
import { useProfile } from "@/features/auth/hooks";
import {
  requestAccountDelete,
  requestDataExport,
} from "@/features/ai/api";
import { loadSampleData } from "@/features/settings/sampleData";
import { useLocalProfile } from "@/features/settings/useLocalProfile";
import { useBackend, localBackend } from "@/lib/backend";
import { setPlannerPing } from "@/lib/notifications";
import { openBillingPortal } from "@/lib/purchases";
import { initAnalyticsIfConsented } from "@/lib/observability";
import { usePlan } from "@/hooks/useEntitlement";
import { useConsentStore } from "@/stores/consent";
import { usePrefsStore } from "@/stores/prefs";
import { useSessionStore } from "@/stores/session";
import { useThemeControls, useTheme } from "@/providers/theme";
import { useRouter } from "expo-router";

export default function Settings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const mode = useSessionStore((s) => s.mode);
  const userId = useSessionStore((s) => s.userId);
  const setGuestOnboarded = useSessionStore((s) => s.setGuestOnboarded);
  const backend = useBackend();
  const plan = usePlan();
  const profile = useProfile();
  const localProfile = useLocalProfile();
  const { preference, setPreference } = useThemeControls();
  const prefs = usePrefsStore();
  const consent = useConsentStore();

  const currentName =
    mode === "authed" ? (profile.data?.name ?? "") : (localProfile.data?.name ?? "");
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const saveName = async () => {
    if (name == null) return;
    setBusy("name");
    try {
      if (mode === "authed" && userId) {
        await updateProfile(userId, { name: name.trim() || null });
        await profile.refetch();
      } else {
        await localBackend.setProfile({ name: name.trim() || null });
        await localProfile.refetch();
      }
      setName(null);
    } finally {
      setBusy(null);
    }
  };

  const doExport = async () => {
    setBusy("export");
    setNotice(null);
    try {
      if (mode === "authed") {
        const blob = await requestDataExport();
        if (Platform.OS === "web") {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `markd-export-${new Date().toISOString().slice(0, 10)}.zip`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setNotice(t("settings.exportStarted"));
      } else {
        const all = await localBackend.exportAll();
        const json = JSON.stringify(all, null, 2);
        if (Platform.OS === "web") {
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "markd-demo-export.json";
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const FileSystem = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
          const Sharing = require("expo-sharing") as typeof import("expo-sharing");
          const path = `${FileSystem.cacheDirectory}markd-demo-export.json`;
          await FileSystem.writeAsStringAsync(path, json);
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
        }
        setNotice(t("settings.exportStarted"));
      }
    } catch {
      setNotice(t("common.error"));
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    if (deleteText !== "DELETE") return;
    setBusy("delete");
    try {
      await requestAccountDelete();
      await signOutEverywhere();
      queryClient.clear();
    } catch {
      setNotice(t("common.error"));
    } finally {
      setBusy(null);
      setDeleteOpen(false);
    }
  };

  const wipeGuest = async () => {
    setBusy("wipe");
    try {
      await localBackend.wipe();
      queryClient.clear();
      setGuestOnboarded(false);
    } finally {
      setBusy(null);
    }
  };

  const sample = async () => {
    setBusy("sample");
    try {
      await loadSampleData(backend);
      await queryClient.invalidateQueries();
      router.replace("/(tabs)");
    } finally {
      setBusy(null);
    }
  };

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <Screen scroll>
      <ScreenHeader title={t("settings.title")} />

      {/* profile */}
      <Reveal>
        <SectionHeader title={t("settings.profile")} style={{ marginTop: 0 }} />
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-end" }}>
            <Input
              label={t("settings.name")}
              value={name ?? currentName}
              onChangeText={setName}
              containerStyle={{ flex: 1 }}
              maxLength={80}
            />
            {name != null && name !== currentName ? (
              <Button label={t("common.save")} loading={busy === "name"} onPress={() => void saveName()} />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {mode === "authed" && profile.data?.year_group ? (
              <Stamp label={profile.data.year_group} color={theme.surface} textColor={theme.ink} rotate={-2} />
            ) : null}
            {mode === "guest" && localProfile.data?.year_group ? (
              <Stamp label={localProfile.data.year_group} color={theme.surface} textColor={theme.ink} rotate={-2} />
            ) : null}
            {mode === "guest" ? <Stamp label={t("auth.guestBadge")} rotate={3} /> : null}
          </View>
        </View>
      </Reveal>

      {/* theme */}
      <Reveal delay={60}>
        <SectionHeader title={t("settings.theme")} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["system", "light", "dark"] as const).map((p) => (
            <Chip
              key={p}
              label={t(
                p === "system"
                  ? "settings.themeSystem"
                  : p === "light"
                    ? "settings.themeLight"
                    : "settings.themeDark",
              )}
              active={preference === p}
              onPress={() => {
                setPreference(p);
                if (mode === "authed" && userId) void updateProfile(userId, { theme: p });
              }}
            />
          ))}
        </View>
      </Reveal>

      {/* notifications */}
      <Reveal delay={100}>
        <SectionHeader title={t("settings.notifications")} />
        <View style={{ gap: 14 }}>
          {(
            [
              ["plannerPing", t("settings.plannerPing")],
              ["deadlineReminders", t("settings.deadlineReminders")],
              ["streakSaver", t("settings.streakSaver")],
            ] as const
          ).map(([key, label]) => (
            <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text variant="bodyMedium">{label}</Text>
              <Toggle
                value={prefs[key]}
                label={label}
                onChange={(next) => {
                  prefs.set({ [key]: next });
                  if (key === "plannerPing") void setPlannerPing(next);
                }}
              />
            </View>
          ))}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text variant="bodyMedium">{t("settings.analytics")}</Text>
            <Toggle
              value={consent.optedIn}
              label={t("settings.analytics")}
              onChange={(next) => {
                consent.decide(next);
                if (next) initAnalyticsIfConsented();
              }}
            />
          </View>
        </View>
      </Reveal>

      {/* plan */}
      <Reveal delay={140}>
        <SectionHeader title={t("settings.plan")} />
        <Slab radius={16} contentStyle={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Stamp
              label={plan.toUpperCase()}
              rotate={-3}
              color={plan === "free" ? theme.well : theme.volt}
              textColor={theme.ink}
            />
            <Text variant="caption" muted style={{ flex: 1 }}>
              {plan === "free" ? t("paywall.headline") : t("more.planPro")}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {plan === "free" ? (
              <Button label={t("settings.upgrade")} icon="rocket" onPress={() => router.push("/paywall")} />
            ) : (
              <Button
                label={t("settings.managePlan")}
                variant="secondary"
                onPress={() => void openBillingPortal()}
              />
            )}
          </View>
        </Slab>
      </Reveal>

      {/* data */}
      <Reveal delay={180}>
        <SectionHeader title={t("settings.data")} />
        <View style={{ gap: 10 }}>
          <Button
            label={t("settings.export")}
            variant="secondary"
            block
            icon="download"
            loading={busy === "export"}
            onPress={() => void doExport()}
          />
          {mode === "guest" ? (
            <>
              <Button
                label={t("settings.loadSample")}
                variant="secondary"
                block
                icon="color-wand"
                loading={busy === "sample"}
                onPress={() => void sample()}
                testID="load-sample"
              />
              <Button
                label={t("settings.guestWipe")}
                variant="danger"
                block
                loading={busy === "wipe"}
                onPress={() => void wipeGuest()}
              />
            </>
          ) : null}
          {mode === "authed" ? (
            <>
              <Button
                label={t("settings.delete")}
                variant="danger"
                block
                onPress={() => setDeleteOpen(true)}
              />
              <Button label={t("auth.signOut")} variant="ghost" block onPress={() => void signOutEverywhere()} />
            </>
          ) : (
            <Button
              label={t("demo.cta")}
              variant="primary"
              block
              onPress={() => {
                useSessionStore.getState().signOut();
              }}
            />
          )}
          {notice ? (
            <Text variant="caption" muted>
              {notice}
            </Text>
          ) : null}
        </View>
      </Reveal>

      <Text variant="monoSm" faint center style={{ marginTop: 30, marginBottom: 10 }}>
        {t("settings.version", { version })}
      </Text>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title={t("settings.deleteConfirmTitle")}>
        <View style={{ gap: 14, paddingBottom: 8 }}>
          <Text variant="body" muted>
            {t("settings.deleteConfirmBody")}
          </Text>
          <Input
            value={deleteText}
            onChangeText={setDeleteText}
            placeholder={t("settings.deleteConfirmPlaceholder")}
            autoCapitalize="characters"
          />
          <Button
            label={t("settings.delete")}
            variant="danger"
            block
            disabled={deleteText !== "DELETE"}
            loading={busy === "delete"}
            onPress={() => void doDelete()}
          />
        </View>
      </Sheet>
    </Screen>
  );
}
