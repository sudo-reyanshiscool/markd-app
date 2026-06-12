import { Platform } from "react-native";

import { Deadline } from "@/db/schemas";
import { parseISODate } from "@/utils/dates";
import { kv, readJSON, writeJSON } from "@/lib/storage";

/**
 * Local notifications (spec §7.4, §7.20). Web builds no-op (the dock badge
 * and Home cover it); native schedules through expo-notifications.
 *
 * Date-only deadlines are treated as 09:00 local: reminders fire 1 day
 * before (09:00 prev day) and 1 hour before (08:00 same day).
 */

const supported = Platform.OS === "ios" || Platform.OS === "android";

type Notifications = typeof import("expo-notifications");

let configured = false;
function api(): Notifications | null {
  if (!supported) return null;
  const Notif = require("expo-notifications") as Notifications;
  if (!configured) {
    Notif.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    configured = true;
  }
  return Notif;
}

export async function ensurePermission(): Promise<boolean> {
  const Notif = api();
  if (!Notif) return false;
  const settings = await Notif.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notif.requestPermissionsAsync();
  return req.granted;
}

const mapKey = (deadlineId: string) => `markd.notif.deadline.${deadlineId}`;

export async function scheduleDeadlineReminders(
  deadline: Pick<Deadline, "id" | "title" | "date">,
): Promise<void> {
  const Notif = api();
  if (!Notif) return;
  if (!(await ensurePermission())) return;
  await cancelDeadlineReminders(deadline.id);

  const day = parseISODate(deadline.date);
  if (!day) return;
  const at = (d: Date) => d.getTime() > Date.now();

  const dayBefore = new Date(day);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);

  const hourBefore = new Date(day);
  hourBefore.setHours(8, 0, 0, 0);

  const ids: string[] = [];
  for (const [when, body] of [
    [dayBefore, "Due tomorrow. Future you says thanks."],
    [hourBefore, "Due today. Last call."],
  ] as const) {
    if (!at(when)) continue;
    const id = await Notif.scheduleNotificationAsync({
      content: { title: deadline.title, body, sound: false },
      trigger: {
        type: Notif.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
    ids.push(id);
  }
  await writeJSON(mapKey(deadline.id), ids);
}

export async function cancelDeadlineReminders(deadlineId: string): Promise<void> {
  const Notif = api();
  if (!Notif) return;
  const ids = (await readJSON<string[]>(mapKey(deadlineId))) ?? [];
  await Promise.all(
    ids.map((id) => Notif.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
  await kv.removeItem(mapKey(deadlineId));
}

const PLANNER_KEY = "markd.notif.planner";
const STREAK_KEY = "markd.notif.streak";

/** Daily planner ping at a fixed morning time (spec §7.20). */
export async function setPlannerPing(enabled: boolean): Promise<void> {
  const Notif = api();
  if (!Notif) return;
  const existing = await kv.getItem(PLANNER_KEY);
  if (existing) {
    await Notif.cancelScheduledNotificationAsync(existing).catch(() => {});
    await kv.removeItem(PLANNER_KEY);
  }
  if (!enabled) return;
  if (!(await ensurePermission())) return;
  const id = await Notif.scheduleNotificationAsync({
    content: {
      title: "Markd",
      body: "What's the one thing today? Open your planner.",
      sound: false,
    },
    trigger: {
      type: Notif.SchedulableTriggerInputTypes.DAILY,
      hour: 7,
      minute: 30,
    },
  });
  await kv.setItem(PLANNER_KEY, id);
}

/** Evening nudge scheduled only when today's streak is unsaved. */
export async function setStreakReminder(atRisk: boolean): Promise<void> {
  const Notif = api();
  if (!Notif) return;
  const existing = await kv.getItem(STREAK_KEY);
  if (existing) {
    await Notif.cancelScheduledNotificationAsync(existing).catch(() => {});
    await kv.removeItem(STREAK_KEY);
  }
  if (!atRisk) return;
  if (!(await ensurePermission())) return;
  const tonight = new Date();
  tonight.setHours(20, 30, 0, 0);
  if (tonight.getTime() <= Date.now()) return;
  const id = await Notif.scheduleNotificationAsync({
    content: {
      title: "Streak on the line",
      body: "One task keeps it alive. Don't blink.",
      sound: false,
    },
    trigger: { type: Notif.SchedulableTriggerInputTypes.DATE, date: tonight },
  });
  await kv.setItem(STREAK_KEY, id);
}

/** Register the Expo push token (authed users; spec §7.20). */
export async function registerPushToken(
  insert: (row: { expo_push_token: string; platform: "ios" | "android" }) => Promise<void>,
): Promise<void> {
  const Notif = api();
  if (!Notif) return;
  if (!(await ensurePermission())) return;
  try {
    const token = await Notif.getExpoPushTokenAsync();
    await insert({
      expo_push_token: token.data,
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
  } catch {
    // Expo Go can't fetch push tokens since SDK 53 — fine, dev builds can.
  }
}
