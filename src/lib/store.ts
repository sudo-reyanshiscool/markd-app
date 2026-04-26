import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AppData, Subject, Task, Exam, Goal, PortfolioItem, StudySession } from "./types";
import { emptyAppData } from "./types";
import { newId } from "./id";
import { supabase, isSupabaseConfigured } from "./supabase";

type Status = "idle" | "loading" | "ready" | "error";

interface State {
  data: AppData;
  status: Status;
  error: string | null;
  userId: string | null;
  email: string | null;
  cloudPending: boolean;
  guestMode: boolean;

  // session
  bootFromSupabase: () => Promise<void>;
  setSession: (userId: string | null, email: string | null) => void;
  setGuestMode: (on: boolean) => void;
  hydrateFromCloud: () => Promise<void>;
  pushToCloud: () => Promise<void>;

  // mutations
  reset: () => void;
  upsertSubject: (s: Omit<Subject, "id"> & { id?: string }) => void;
  removeSubject: (id: string) => void;
  addTask: (t: Omit<Task, "id" | "createdAt" | "done">) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  upsertExam: (e: Omit<Exam, "id"> & { id?: string }) => void;
  removeExam: (id: string) => void;
  upsertGoal: (g: Omit<Goal, "id" | "done"> & { id?: string; done?: boolean }) => void;
  toggleGoal: (id: string) => void;
  removeGoal: (id: string) => void;
  upsertPortfolio: (p: Omit<PortfolioItem, "id"> & { id?: string }) => void;
  removePortfolio: (id: string) => void;
  logStudySession: (s: Omit<StudySession, "id" | "startedAt"> & { startedAt?: string }) => void;
  setOutlookUrl: (url: string) => void;
  setRevisionMode: (on: boolean) => void;
  setMockMode: (on: boolean) => void;
}

const LOCAL_KEY = "markd:cache:v1";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePush(get: () => State) {
  if (!isSupabaseConfigured) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void get().pushToCloud();
  }, 600);
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      data: emptyAppData(),
      status: "idle",
      error: null,
      userId: null,
      email: null,
      cloudPending: false,
      guestMode: false,

      bootFromSupabase: async () => {
        if (!isSupabaseConfigured || !supabase) {
          set({ status: "ready" });
          return;
        }
        set({ status: "loading" });
        try {
          const { data: sess } = await supabase.auth.getSession();
          const user = sess.session?.user ?? null;
          if (!user) {
            set({ status: "ready", userId: null, email: null });
            return;
          }
          set({ userId: user.id, email: user.email ?? null });
          await get().hydrateFromCloud();
          set({ status: "ready" });
        } catch (e) {
          set({ status: "error", error: (e as Error).message });
        }
      },

      setSession: (userId, email) => set({ userId, email, guestMode: userId ? false : get().guestMode }),
      setGuestMode: (guestMode) => set({ guestMode }),

      hydrateFromCloud: async () => {
        if (!supabase) return;
        const userId = get().userId;
        if (!userId) return;
        const { data, error } = await supabase
          .from("profiles")
          .select("app_data")
          .eq("id", userId)
          .maybeSingle();
        if (error) {
          set({ status: "error", error: error.message });
          return;
        }
        const incoming = (data?.app_data ?? {}) as Partial<AppData>;
        set({ data: { ...emptyAppData(), ...incoming } });
      },

      pushToCloud: async () => {
        if (!supabase) return;
        const userId = get().userId;
        if (!userId) return;
        set({ cloudPending: true });
        const { error } = await supabase
          .from("profiles")
          .update({ app_data: get().data })
          .eq("id", userId);
        set({ cloudPending: false, error: error ? error.message : null });
      },

      reset: () => set({ data: emptyAppData() }),

      upsertSubject: (s) => {
        const id = s.id ?? newId();
        const exists = get().data.subjects.some((x) => x.id === id);
        const next = { ...s, id } as Subject;
        set((st) => ({
          data: {
            ...st.data,
            subjects: exists
              ? st.data.subjects.map((x) => (x.id === id ? { ...x, ...next } : x))
              : [...st.data.subjects, next],
          },
        }));
        schedulePush(get);
      },
      removeSubject: (id) => {
        set((st) => ({
          data: { ...st.data, subjects: st.data.subjects.filter((x) => x.id !== id) },
        }));
        schedulePush(get);
      },

      addTask: (t) => {
        const task: Task = {
          ...t,
          id: newId(),
          done: false,
          createdAt: new Date().toISOString(),
        };
        set((st) => ({ data: { ...st.data, tasks: [task, ...st.data.tasks] } }));
        schedulePush(get);
      },
      toggleTask: (id) => {
        set((st) => ({
          data: {
            ...st.data,
            tasks: st.data.tasks.map((t) =>
              t.id === id
                ? {
                    ...t,
                    done: !t.done,
                    completedAt: !t.done ? new Date().toISOString() : undefined,
                  }
                : t,
            ),
          },
        }));
        schedulePush(get);
      },
      removeTask: (id) => {
        set((st) => ({ data: { ...st.data, tasks: st.data.tasks.filter((t) => t.id !== id) } }));
        schedulePush(get);
      },

      upsertExam: (e) => {
        const id = e.id ?? newId();
        const exists = get().data.exams.some((x) => x.id === id);
        const next = { ...e, id } as Exam;
        set((st) => ({
          data: {
            ...st.data,
            exams: exists
              ? st.data.exams.map((x) => (x.id === id ? next : x))
              : [...st.data.exams, next],
          },
        }));
        schedulePush(get);
      },
      removeExam: (id) => {
        set((st) => ({ data: { ...st.data, exams: st.data.exams.filter((x) => x.id !== id) } }));
        schedulePush(get);
      },

      upsertGoal: (g) => {
        const id = g.id ?? newId();
        const exists = get().data.goals.some((x) => x.id === id);
        const next: Goal = { done: false, ...g, id };
        set((st) => ({
          data: {
            ...st.data,
            goals: exists
              ? st.data.goals.map((x) => (x.id === id ? next : x))
              : [...st.data.goals, next],
          },
        }));
        schedulePush(get);
      },
      toggleGoal: (id) => {
        set((st) => ({
          data: {
            ...st.data,
            goals: st.data.goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)),
          },
        }));
        schedulePush(get);
      },
      removeGoal: (id) => {
        set((st) => ({ data: { ...st.data, goals: st.data.goals.filter((x) => x.id !== id) } }));
        schedulePush(get);
      },

      upsertPortfolio: (p) => {
        const id = p.id ?? newId();
        const exists = get().data.portfolio.some((x) => x.id === id);
        const next = { ...p, id } as PortfolioItem;
        set((st) => ({
          data: {
            ...st.data,
            portfolio: exists
              ? st.data.portfolio.map((x) => (x.id === id ? next : x))
              : [...st.data.portfolio, next],
          },
        }));
        schedulePush(get);
      },
      removePortfolio: (id) => {
        set((st) => ({
          data: { ...st.data, portfolio: st.data.portfolio.filter((x) => x.id !== id) },
        }));
        schedulePush(get);
      },

      logStudySession: (s) => {
        const session: StudySession = {
          ...s,
          id: newId(),
          startedAt: s.startedAt ?? new Date().toISOString(),
        };
        set((st) => ({
          data: { ...st.data, studySessions: [session, ...st.data.studySessions] },
        }));
        schedulePush(get);
      },

      setOutlookUrl: (outlookCalendarUrl) => {
        set((st) => ({ data: { ...st.data, outlookCalendarUrl } }));
        schedulePush(get);
      },
      setRevisionMode: (revisionMode) => {
        set((st) => ({ data: { ...st.data, revisionMode } }));
        schedulePush(get);
      },
      setMockMode: (mockMode) => {
        set((st) => ({ data: { ...st.data, mockMode } }));
        schedulePush(get);
      },
    }),
    {
      name: LOCAL_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ data: s.data, guestMode: s.guestMode }),
    },
  ),
);
