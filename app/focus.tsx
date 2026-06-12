import React, { useEffect, useRef, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import Svg, { Circle } from "react-native-svg";

import {
  Button,
  Chip,
  Doodle,
  IconButton,
  Reveal,
  Screen,
  Stamp,
  Text,
} from "@/components/ui";
import { fonts, subjectHex } from "@/constants/theme";
import { useStudySessions, useSubjects } from "@/hooks/domains";
import { cheer } from "@/lib/haptics";
import { useTheme } from "@/providers/theme";
import { FOCUS_PRESETS, focusPhase, useFocusStore } from "@/stores/focusTimer";

const RING = 260;
const R = 118;
const CIRC = 2 * Math.PI * R;

function useNowTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export default function Focus() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const store = useFocusStore();
  const { active: subjects } = useSubjects();
  const sessions = useStudySessions();
  const [celebrating, setCelebrating] = useState<number | null>(null);
  const loggedRef = useRef(false);

  const phase = focusPhase(store);
  const now = useNowTick(phase === "running");

  const totalMs = store.presetMinutes * 60_000;
  const remainingMs =
    phase === "running"
      ? Math.max(0, (store.endsAt ?? 0) - now)
      : phase === "paused"
        ? (store.pausedRemainingMs ?? 0)
        : totalMs;

  // completion
  useEffect(() => {
    if (phase === "running" && remainingMs <= 0 && !loggedRef.current) {
      loggedRef.current = true;
      const minutes = store.presetMinutes;
      void sessions.log(minutes, store.subjectId, store.taskId).then(() => {
        cheer();
        setCelebrating(minutes);
        store.finish();
        setTimeout(() => {
          loggedRef.current = false;
        }, 500);
      });
    }
  }, [phase, remainingMs, sessions, store]);

  const mins = Math.floor(remainingMs / 60_000);
  const secs = Math.floor((remainingMs % 60_000) / 1000);
  const progress = totalMs === 0 ? 0 : 1 - remainingMs / totalMs;

  const isLight = theme.name === "light";
  const takeover = phase !== "idle" || celebrating !== null;
  const bg = takeover ? (isLight ? theme.volt : theme.bg) : theme.bg;
  const fg = takeover && isLight ? "#16140F" : theme.ink;

  return (
    <Screen plain color={bg}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton
          icon="chevron-down"
          label={t("common.close")}
          onPress={() => router.back()}
        />
        <Text variant="label" color={fg} style={{ opacity: 0.7 }}>
          {celebrating !== null
            ? t("focus.completeTitle")
            : phase === "running"
              ? t("focus.phaseRunning")
              : phase === "paused"
                ? t("focus.phasePaused")
                : t("focus.phaseIdle")}
        </Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {celebrating !== null ? (
          <Reveal from="scale" style={{ alignItems: "center", gap: 18 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Doodle kind="burst" size={48} rotate={-10} color={fg} />
              <Doodle kind="star" size={30} rotate={15} color={fg} style={{ marginTop: 26 }} />
              <Doodle kind="zap" size={38} rotate={6} color={fg} />
            </View>
            <Text variant="displayXL" color={fg} center style={{ fontSize: 38, lineHeight: 46 }}>
              {t("focus.completeTitle")}
            </Text>
            <Stamp label={t("focus.logged", { count: celebrating })} rotate={-3} color={isLight ? "#16140F" : theme.volt} textColor={isLight ? "#C8FF1F" : "#16140F"} />
            <Text variant="body" color={fg} style={{ opacity: 0.75 }} center>
              {t("focus.completeSub", { count: celebrating })}
            </Text>
            <Button
              label={t("common.done")}
              variant={isLight ? "secondary" : "primary"}
              size="lg"
              onPress={() => setCelebrating(null)}
            />
          </Reveal>
        ) : (
          <View style={{ alignItems: "center", gap: 26 }}>
            {/* ring */}
            <Reveal from="scale">
              <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
                <Svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`} style={{ position: "absolute" }}>
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={R}
                    stroke={takeover && isLight ? "rgba(22,20,15,0.18)" : theme.well}
                    strokeWidth={14}
                    fill="none"
                  />
                  <Circle
                    cx={RING / 2}
                    cy={RING / 2}
                    r={R}
                    stroke={takeover && isLight ? "#16140F" : theme.volt}
                    strokeWidth={14}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${CIRC}`}
                    strokeDashoffset={CIRC * (1 - progress)}
                    transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
                  />
                </Svg>
                <Text
                  style={{
                    fontFamily: fonts.monoBold,
                    fontSize: 52,
                    lineHeight: 60,
                    letterSpacing: 1,
                    color: fg,
                    fontVariant: ["tabular-nums"],
                  }}
                  accessibilityLabel={`${mins} minutes ${secs} seconds remaining`}
                >
                  {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                </Text>
                <Text variant="monoSm" color={fg} style={{ opacity: 0.6, marginTop: 6 }}>
                  / {store.presetMinutes}:00
                </Text>
              </View>
            </Reveal>

            {phase === "idle" ? (
              <>
                <Reveal delay={80} style={{ flexDirection: "row", gap: 10 }}>
                  {FOCUS_PRESETS.map((preset) => (
                    <Chip
                      key={preset}
                      label={t("focus.preset", { count: preset })}
                      active={store.presetMinutes === preset}
                      onPress={() => store.setPreset(preset)}
                    />
                  ))}
                </Reveal>
                {subjects.length > 0 ? (
                  <Reveal delay={140} style={{ maxWidth: "100%" }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
                      <Chip
                        label={t("focus.noSubject")}
                        active={store.subjectId === null}
                        onPress={() => store.setSubject(null)}
                      />
                      {subjects.map((s) => (
                        <Chip
                          key={s.id}
                          label={s.name}
                          active={store.subjectId === s.id}
                          activeColor={subjectHex(s.color)}
                          onPress={() => store.setSubject(s.id)}
                        />
                      ))}
                    </ScrollView>
                  </Reveal>
                ) : null}
                <Reveal delay={200}>
                  <Button label={t("focus.start")} size="lg" icon="play" onPress={() => store.start()} testID="focus-start" />
                </Reveal>
              </>
            ) : (
              <View style={{ flexDirection: "row", gap: 12 }}>
                {phase === "running" ? (
                  <Button
                    label={t("focus.pause")}
                    variant={isLight && takeover ? "secondary" : "secondary"}
                    icon="pause"
                    onPress={() => store.pause()}
                  />
                ) : (
                  <Button label={t("focus.resume")} icon="play" onPress={() => store.resume()} />
                )}
                <Button
                  label={t("focus.abandon")}
                  variant="danger"
                  icon="close"
                  onPress={() => store.abandon()}
                />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
