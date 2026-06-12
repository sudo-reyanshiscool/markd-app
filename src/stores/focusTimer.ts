import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/lib/storage";

export const FOCUS_PRESETS = [25, 45, 60] as const;
export type FocusPreset = (typeof FOCUS_PRESETS)[number];

/**
 * Focus timer (spec §7.14). Lives in a store so it survives navigation;
 * endsAt-based math so it survives background/foreground and reload too.
 */
interface FocusState {
  presetMinutes: number;
  subjectId: string | null;
  taskId: string | null;
  /** Epoch ms when the running timer completes; null when idle/paused. */
  endsAt: number | null;
  /** Remaining ms while paused; null unless paused. */
  pausedRemainingMs: number | null;
  startedAt: number | null;

  setPreset: (minutes: number) => void;
  setSubject: (subjectId: string | null) => void;
  setTask: (taskId: string | null) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  abandon: () => void;
  /** Clear state after the completion has been logged. */
  finish: () => void;
}

export const useFocusStore = create<FocusState>()(
  persist(
    (set, get) => ({
      presetMinutes: 25,
      subjectId: null,
      taskId: null,
      endsAt: null,
      pausedRemainingMs: null,
      startedAt: null,

      setPreset: (presetMinutes) => set({ presetMinutes }),
      setSubject: (subjectId) => set({ subjectId }),
      setTask: (taskId) => set({ taskId }),

      start: () => {
        const { presetMinutes } = get();
        set({
          endsAt: Date.now() + presetMinutes * 60_000,
          pausedRemainingMs: null,
          startedAt: Date.now(),
        });
      },
      pause: () => {
        const { endsAt } = get();
        if (!endsAt) return;
        set({ pausedRemainingMs: Math.max(0, endsAt - Date.now()), endsAt: null });
      },
      resume: () => {
        const { pausedRemainingMs } = get();
        if (pausedRemainingMs == null) return;
        set({ endsAt: Date.now() + pausedRemainingMs, pausedRemainingMs: null });
      },
      abandon: () =>
        set({ endsAt: null, pausedRemainingMs: null, startedAt: null }),
      finish: () =>
        set({ endsAt: null, pausedRemainingMs: null, startedAt: null }),
    }),
    {
      name: "markd.focus",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export type FocusPhase = "idle" | "running" | "paused";

export function focusPhase(s: Pick<FocusState, "endsAt" | "pausedRemainingMs">): FocusPhase {
  if (s.endsAt) return "running";
  if (s.pausedRemainingMs != null) return "paused";
  return "idle";
}
