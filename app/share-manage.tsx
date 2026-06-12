import React, { useState } from "react";
import { Platform, Share as RNShare, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  Reveal,
  Screen,
  ScreenHeader,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { fonts } from "@/constants/theme";
import { createShareLink, revokeShareLink } from "@/features/ai/api";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useBackend, useDataScope } from "@/lib/backend";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";
import { formatDateLong, timestampToLocalISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

export default function ShareManage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const mode = useSessionStore((s) => s.mode);
  const shareEnt = useEntitlement("shareLinks");
  const backend = useBackend();
  const scope = useDataScope();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const links = useQuery({
    queryKey: [scope, "share_links"],
    queryFn: async () => {
      if (backend.kind !== "supabase" || !supabase) return [];
      // share_links is remote-only; owner sees their rows via RLS
      const { data, error: qError } = await supabase
        .from("share_links")
        .select("*")
        .order("created_at", { ascending: false });
      if (qError) throw qError;
      return data ?? [];
    },
    enabled: mode === "authed",
  });

  const activeLink = (links.data ?? []).find(
    (l: { expires_at: string }) => new Date(l.expires_at).getTime() > Date.now(),
  ) as { slug: string; expires_at: string; view_count: number } | undefined;

  const baseUrl = process.env.EXPO_PUBLIC_APP_WEB_URL ?? "https://markd.app";
  const fullUrl = activeLink ? `${baseUrl}/share/${activeLink.slug}` : null;

  const create = async () => {
    if (!shareEnt.requirePro()) return;
    setBusy(true);
    setError(null);
    try {
      await createShareLink();
      await links.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!fullUrl) return;
    if (Platform.OS === "web") {
      await globalThis.navigator?.clipboard?.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } else {
      await RNShare.share({ message: fullUrl });
    }
  };

  const revoke = async () => {
    if (!activeLink) return;
    setBusy(true);
    try {
      await revokeShareLink(activeLink.slug);
      await links.refetch();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <ScreenHeader title={t("share.title")} />

      <Reveal>
        <Slab radius={18} contentStyle={{ padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Ionicons name="link" size={18} color={theme.ink} />
            <Stamp label="PRO" size="sm" rotate={4} />
          </View>
          <Text variant="body" muted>
            {t("share.explainer")}
          </Text>

          {mode !== "authed" ? (
            <Slab shadow={false} color={theme.well} contentStyle={{ padding: 12 }}>
              <Text variant="caption" muted>
                {t("share.guestBlocked")}
              </Text>
            </Slab>
          ) : activeLink ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" muted>
                {t("share.active")}
              </Text>
              <Slab shadow={false} color={theme.well} contentStyle={{ padding: 12 }}>
                <Text style={{ fontFamily: fonts.monoBold, fontSize: 13 }} numberOfLines={1}>
                  {fullUrl}
                </Text>
              </Slab>
              <Text variant="monoSm" muted>
                {t("share.expires", {
                  date: formatDateLong(timestampToLocalISODate(activeLink.expires_at)),
                })}
                {" · "}
                {t("share.views", { count: activeLink.view_count })}
              </Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Button
                  label={copied ? t("share.copied") : t("share.copy")}
                  icon={copied ? "checkmark" : "copy"}
                  onPress={() => void copy()}
                />
                <Button label={t("share.revoke")} variant="danger" loading={busy} onPress={() => void revoke()} />
              </View>
            </View>
          ) : (
            <Button
              label={busy ? t("share.creating") : t("share.create")}
              size="lg"
              icon="sparkles"
              loading={busy}
              onPress={() => void create()}
              testID="share-create"
            />
          )}
          {error ? (
            <Text variant="caption" color={theme.danger}>
              {error}
            </Text>
          ) : null}
        </Slab>
      </Reveal>
    </Screen>
  );
}
