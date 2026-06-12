import React, { useState } from "react";
import { Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  SectionHeader,
  Slab,
  Stamp,
  Text,
} from "@/components/ui";
import { syncCalendarFeed } from "@/features/ai/api";
import { useEntityList, useEntityMutations } from "@/hooks/useEntities";
import { useEntitlement } from "@/hooks/useEntitlement";
import { useBackend } from "@/lib/backend";
import { useSessionStore } from "@/stores/session";
import { formatDateLong, timestampToLocalISODate } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

const DEVICE_FEED_URL = "device://local-calendar";

export default function CalendarImport() {
  const { t } = useTranslation();
  const theme = useTheme();
  const backend = useBackend();
  const mode = useSessionStore((s) => s.mode);
  const feeds = useEntityList("calendar_feeds");
  const feedMutations = useEntityMutations("calendar_feeds");
  const events = useEntityList("calendar_events");
  const eventMutations = useEntityMutations("calendar_events");
  const calendarFeeds = useEntitlement("calendarFeeds");

  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [busyFeed, setBusyFeed] = useState<string | null>(null);
  const [nativeBusy, setNativeBusy] = useState(false);
  const [nativeMsg, setNativeMsg] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);

  // ---------------- native device calendar (spec §7.12 path 1)
  const importDevice = async () => {
    if (Platform.OS === "web") {
      setNativeMsg(t("calendar.nativeUnavailable"));
      return;
    }
    setNativeBusy(true);
    setNativeMsg(null);
    try {
      const Calendar = require("expo-calendar") as typeof import("expo-calendar");
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== "granted") {
        setNativeMsg(t("calendar.nativeDenied"));
        return;
      }
      // synthetic local feed row to own the device events
      let deviceFeed = (feeds.data ?? []).find((f) => f.url === DEVICE_FEED_URL);
      if (!deviceFeed) {
        deviceFeed = await backend.insert("calendar_feeds", {
          url: DEVICE_FEED_URL,
          label: t("calendar.native"),
          last_synced_at: null,
          last_event_count: null,
          status: "pending",
          last_error: null,
        });
      }
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 90);
      const deviceEvents = await Calendar.getEventsAsync(
        calendars.map((c) => c.id),
        start,
        end,
      );
      const existing = new Set(
        (events.data ?? [])
          .filter((e) => e.feed_id === deviceFeed.id)
          .map((e) => e.uid),
      );
      let imported = 0;
      for (const ev of deviceEvents.slice(0, 200)) {
        const uid = String(ev.id);
        if (existing.has(uid)) continue;
        await eventMutations.add.mutateAsync({
          feed_id: deviceFeed.id,
          uid,
          title: ev.title || "Event",
          starts_at: new Date(ev.startDate as string | Date).toISOString(),
          ends_at: ev.endDate ? new Date(ev.endDate as string | Date).toISOString() : null,
          location: ev.location ?? null,
          description: null,
          all_day: Boolean(ev.allDay),
        });
        imported += 1;
      }
      await feedMutations.update.mutateAsync({
        id: deviceFeed.id,
        patch: {
          status: "ok",
          last_synced_at: new Date().toISOString(),
          last_event_count: imported,
        },
      });
      setNativeMsg(t("calendar.nativeImported", { count: imported }));
    } catch {
      setNativeMsg(t("common.error"));
    } finally {
      setNativeBusy(false);
    }
  };

  // ---------------- .ics URL feeds (spec §7.12 path 2, Pro + authed)
  const canUseFeeds = mode === "authed";

  const addFeed = async () => {
    if (!calendarFeeds.requirePro()) return;
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://")) {
      setFeedError(t("common.error"));
      return;
    }
    setFeedError(null);
    setBusyFeed("new");
    try {
      await syncCalendarFeed({ url: trimmed, label: label.trim() || undefined });
      setUrl("");
      setLabel("");
      await feeds.refetch();
      await events.refetch();
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusyFeed(null);
    }
  };

  const resync = async (feedId: string) => {
    setBusyFeed(feedId);
    try {
      await syncCalendarFeed({ feed_id: feedId });
      await feeds.refetch();
      await events.refetch();
    } catch (e) {
      setFeedError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusyFeed(null);
    }
  };

  const urlFeeds = (feeds.data ?? []).filter((f) => f.url !== DEVICE_FEED_URL);

  return (
    <Screen scroll>
      <ScreenHeader title={t("calendar.title")} />

      {/* native */}
      <Reveal>
        <Slab radius={16} contentStyle={{ padding: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="phone-portrait" size={16} color={theme.ink} />
            <Text variant="heading">{t("calendar.native")}</Text>
          </View>
          <Text variant="caption" muted>
            {t("calendar.nativeSub")}
          </Text>
          <Button
            label={t("calendar.nativeImport")}
            icon="download"
            loading={nativeBusy}
            onPress={() => void importDevice()}
          />
          {nativeMsg ? (
            <Text variant="caption" muted>
              {nativeMsg}
            </Text>
          ) : null}
        </Slab>
      </Reveal>

      {/* feeds */}
      <SectionHeader title={t("calendar.feeds")} />
      {!canUseFeeds ? (
        <Slab shadow={false} color={theme.well} contentStyle={{ padding: 14 }}>
          <Text variant="bodyMedium" muted>
            {t("calendar.guestBlocked")}
          </Text>
        </Slab>
      ) : (
        <Reveal>
          <View style={{ gap: 10 }}>
            <Input
              label={t("calendar.feeds")}
              value={url}
              onChangeText={setUrl}
              placeholder={t("calendar.feedUrl")}
              autoCapitalize="none"
              keyboardType="url"
              testID="feed-url"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Input
                value={label}
                onChangeText={setLabel}
                placeholder={t("calendar.feedLabel")}
                containerStyle={{ flex: 1 }}
              />
              <Button
                label={t("calendar.feedAdd")}
                loading={busyFeed === "new"}
                disabled={!url.trim()}
                onPress={() => void addFeed()}
              />
            </View>
            {feedError ? (
              <Text variant="caption" color={theme.danger}>
                {feedError}
              </Text>
            ) : null}
          </View>
        </Reveal>
      )}

      <View style={{ gap: 10, marginTop: 14, paddingBottom: 40 }}>
        {urlFeeds.length === 0 && canUseFeeds ? (
          <Text variant="caption" faint>
            {t("calendar.feedEmptySub")}
          </Text>
        ) : null}
        {urlFeeds.map((feed) => (
          <Slab key={feed.id} radius={14} offset={3} contentStyle={{ padding: 13, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Stamp
                label={feed.status.toUpperCase()}
                size="sm"
                rotate={-2}
                color={
                  feed.status === "ok"
                    ? theme.volt
                    : feed.status === "error"
                      ? theme.danger
                      : theme.well
                }
                textColor={feed.status === "error" ? theme.onDanger : "#16140F"}
              />
              <Text variant="bodyBold" style={{ flex: 1 }} numberOfLines={1}>
                {feed.label || feed.url}
              </Text>
            </View>
            <Text variant="monoSm" muted numberOfLines={1}>
              {feed.url}
            </Text>
            {feed.last_synced_at ? (
              <Text variant="monoSm" faint>
                {t("calendar.lastSync", {
                  date: formatDateLong(timestampToLocalISODate(feed.last_synced_at)),
                  count: feed.last_event_count ?? 0,
                })}
              </Text>
            ) : null}
            {feed.last_error ? (
              <Text variant="caption" color={theme.danger} numberOfLines={2}>
                {feed.last_error}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                label={busyFeed === feed.id ? t("calendar.feedSyncing") : t("calendar.feedSync")}
                size="sm"
                loading={busyFeed === feed.id}
                onPress={() => void resync(feed.id)}
              />
              <Button
                label={t("calendar.feedDelete")}
                variant="danger"
                size="sm"
                onPress={() => void feedMutations.remove.mutateAsync(feed.id)}
              />
            </View>
          </Slab>
        ))}
      </View>
    </Screen>
  );
}
