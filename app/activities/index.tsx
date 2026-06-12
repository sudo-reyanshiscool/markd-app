import React, { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";

import {
  Button,
  DateField,
  EmptyState,
  FAB,
  Input,
  Reveal,
  Screen,
  ScreenHeader,
  Sheet,
  Slab,
  Text,
} from "@/components/ui";
import { ColorPicker } from "@/components/ColorPicker";
import { fonts, subjectHex } from "@/constants/theme";
import { Activity } from "@/db/schemas";
import { useActivities, useActivityEvents } from "@/hooks/domains";
import { formatDateLong } from "@/utils/dates";
import { useTheme } from "@/providers/theme";

function ActivityForm({ open, onClose, activity }: { open: boolean; onClose: () => void; activity: Activity | null }) {
  const { t } = useTranslation();
  const activities = useActivities();
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [organisation, setOrganisation] = useState("");
  const [hours, setHours] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("mint");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) {
      setName(activity?.name ?? "");
      setRole(activity?.role ?? "");
      setOrganisation(activity?.organisation ?? "");
      setHours(activity?.hours_per_week != null ? String(activity.hours_per_week) : "");
      setDescription(activity?.description ?? "");
      setColor(activity?.color ?? "mint");
    }
  }, [open, activity]);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const patch = {
        name: name.trim(),
        role: role.trim() || null,
        organisation: organisation.trim() || null,
        hours_per_week: hours ? Number(hours) : null,
        description: description.trim() || null,
        color,
        tags: activity?.tags ?? [],
      };
      if (activity) await activities.update.mutateAsync({ id: activity.id, patch });
      else await activities.add.mutateAsync(patch);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={activity ? t("activities.edit") : t("activities.add")}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Input label={t("activities.name")} value={name} onChangeText={setName} maxLength={120} testID="activity-name" />
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Input label={t("activities.role")} value={role} onChangeText={setRole} maxLength={120} containerStyle={{ flex: 1 }} placeholder="Captain, member…" />
          <Input label={t("activities.hours")} value={hours} onChangeText={setHours} keyboardType="decimal-pad" containerStyle={{ width: 120 }} />
        </View>
        <Input label={t("activities.organisation")} value={organisation} onChangeText={setOrganisation} maxLength={160} />
        <Input label={t("activities.description")} value={description} onChangeText={setDescription} multiline maxLength={4000} />
        <View style={{ gap: 8 }}>
          <Text variant="label" muted>
            {t("subjects.colour")}
          </Text>
          <ColorPicker value={color} onChange={setColor} />
        </View>
        <Button label={t("common.save")} size="lg" block loading={busy} disabled={!name.trim()} onPress={save} testID="activity-save" />
        {activity ? (
          <Button
            label={t("common.delete")}
            variant="danger"
            block
            onPress={async () => {
              await activities.remove.mutateAsync(activity.id);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Sheet>
  );
}

function EventForm({ open, onClose, activityId }: { open: boolean; onClose: () => void; activityId: string }) {
  const { t } = useTranslation();
  const events = useActivityEvents();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    if (open) {
      setTitle("");
      setDate(null);
      setDescription("");
    }
  }, [open]);

  const save = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await events.add.mutateAsync({
        activity_id: activityId,
        title: title.trim(),
        date,
        description: description.trim() || null,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("activities.addEvent")}>
      <View style={{ gap: 16, paddingBottom: 8 }}>
        <Input label={t("activities.eventTitle")} value={title} onChangeText={setTitle} maxLength={160} />
        <DateField label={t("activities.eventDate")} value={date} onChange={setDate} />
        <Input label={t("activities.description")} value={description} onChangeText={setDescription} multiline maxLength={2000} />
        <Button label={t("common.save")} size="lg" block loading={busy} disabled={!title.trim()} onPress={save} />
      </View>
    </Sheet>
  );
}

export default function Activities() {
  const { t } = useTranslation();
  const theme = useTheme();
  const activities = useActivities();
  const allEvents = useActivityEvents();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [eventFor, setEventFor] = useState<string | null>(null);

  const all = activities.query.data ?? [];

  return (
    <Screen scroll>
      <ScreenHeader title={t("activities.title")} />
      {all.length === 0 ? (
        <EmptyState
          title={t("activities.empty")}
          body={t("activities.emptySub")}
          doodle="zap"
          cta={t("activities.add")}
          onCta={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <View style={{ gap: 12, paddingBottom: 90 }}>
          {all.map((activity, i) => {
            const isExpanded = expanded === activity.id;
            const events = (allEvents.query.data ?? [])
              .filter((e) => e.activity_id === activity.id)
              .sort((a, b) => ((a.date ?? "") > (b.date ?? "") ? -1 : 1));
            return (
              <Reveal key={activity.id} delay={40 + Math.min(i, 8) * 30}>
                <Slab
                  radius={16}
                  rotate={i % 2 ? 0.5 : -0.5}
                  onPress={() => setExpanded(isExpanded ? null : activity.id)}
                  haptic={false}
                  accessibilityLabel={activity.name}
                  contentStyle={{ overflow: "hidden" }}
                >
                  <View
                    style={{
                      backgroundColor: subjectHex(activity.color),
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderBottomWidth: 2,
                      borderBottomColor: theme.border,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.display, fontSize: 14, color: "#16140F", flex: 1 }} numberOfLines={1}>
                      {activity.name.toUpperCase()}
                    </Text>
                    {activity.hours_per_week != null ? (
                      <Text style={{ fontFamily: fonts.monoBold, fontSize: 11, color: "#16140F" }}>
                        {activity.hours_per_week}H/WK
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ padding: 14, gap: 8 }}>
                    <Text variant="caption" muted>
                      {[activity.role, activity.organisation].filter(Boolean).join(" · ") || " "}
                    </Text>
                    {isExpanded ? (
                      <View style={{ gap: 10 }}>
                        {activity.description ? (
                          <Text variant="body" muted>
                            {activity.description}
                          </Text>
                        ) : null}
                        <Text variant="label" muted>
                          {t("activities.events")}
                        </Text>
                        {events.length === 0 ? (
                          <Text variant="caption" faint>
                            —
                          </Text>
                        ) : (
                          events.map((event) => (
                            <View key={event.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                              <Ionicons name="flag" size={12} color={theme.inkMuted} style={{ marginTop: 3 }} />
                              <View style={{ flex: 1 }}>
                                <Text variant="bodyMedium">{event.title}</Text>
                                {event.date ? (
                                  <Text variant="monoSm" faint>
                                    {formatDateLong(event.date)}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          ))
                        )}
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <Button label={t("activities.addEvent")} size="sm" icon="flag" onPress={() => setEventFor(activity.id)} />
                          <Button
                            label={t("common.edit")}
                            variant="secondary"
                            size="sm"
                            onPress={() => {
                              setEditing(activity);
                              setFormOpen(true);
                            }}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                </Slab>
              </Reveal>
            );
          })}
        </View>
      )}

      <ActivityForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        activity={editing}
      />
      {eventFor ? <EventForm open onClose={() => setEventFor(null)} activityId={eventFor} /> : null}
      {all.length > 0 ? (
        <FAB
          onPress={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          label={t("activities.add")}
          aboveDock={false}
        />
      ) : null}
    </Screen>
  );
}
