import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  CalendarEvent,
  Deadline,
  Exam,
  Goal,
  Subject,
  Task,
} from "@/db/schemas";
import { useBackend, useDataScope } from "@/lib/backend";
import {
  cancelDeadlineReminders,
  scheduleDeadlineReminders,
} from "@/lib/notifications";
import {
  activityDateSet,
  levelForXp,
  streakDays,
  subjectHealth,
  SubjectHealth,
  totalXp,
  weeklySummary,
} from "@/utils/gamification";
import { doNext, rankTasks } from "@/utils/ranking";
import { nextOccurrence } from "@/utils/recurrence";
import { todayISO } from "@/utils/dates";

import { entityKey, useEntityList, useEntityMutations } from "./useEntities";

// ------------------------------------------------------------- subjects
export function useSubjects() {
  const query = useEntityList("subjects");
  const mutations = useEntityMutations("subjects");

  const active = useMemo(
    () =>
      (query.data ?? [])
        .filter((s) => !s.archived_at)
        .sort((a, b) => a.position - b.position || (a.created_at < b.created_at ? -1 : 1)),
    [query.data],
  );
  const archived = useMemo(
    () => (query.data ?? []).filter((s) => Boolean(s.archived_at)),
    [query.data],
  );

  const reorder = async (orderedIds: string[]) => {
    await Promise.all(
      orderedIds.map((id, position) =>
        mutations.update.mutateAsync({ id, patch: { position } }),
      ),
    );
  };

  return { query, active, archived, ...mutations, reorder };
}

export function useSubjectMap(): Map<string, Subject> {
  const { query } = useSubjects();
  return useMemo(
    () => new Map((query.data ?? []).map((s) => [s.id, s])),
    [query.data],
  );
}

// ---------------------------------------------------------------- tasks
export function useTasks() {
  const query = useEntityList("tasks");
  const mutations = useEntityMutations("tasks");

  const open = useMemo(
    () => rankTasks(query.data ?? [], new Date()),
    [query.data],
  );
  const done = useMemo(
    () =>
      (query.data ?? [])
        .filter((t) => t.done)
        .sort((a, b) => ((a.completed_at ?? "") > (b.completed_at ?? "") ? -1 : 1)),
    [query.data],
  );
  const snoozed = useMemo(
    () =>
      (query.data ?? []).filter(
        (t) =>
          !t.done &&
          t.snoozed_until &&
          new Date(t.snoozed_until).getTime() > Date.now(),
      ),
    [query.data],
  );

  /** Complete: set done, stamp time, spawn next occurrence for recurrers. */
  const complete = async (task: Task) => {
    await mutations.update.mutateAsync({
      id: task.id,
      patch: { done: true, completed_at: new Date().toISOString() },
    });
    if (task.recurrence && task.due_date) {
      await mutations.add.mutateAsync({
        subject_id: task.subject_id,
        text: task.text,
        done: false,
        priority: task.priority,
        estimate_minutes: task.estimate_minutes,
        topic: task.topic,
        due_date: nextOccurrence(task.recurrence, task.due_date),
        recurrence: task.recurrence,
        snoozed_until: null,
        completed_at: null,
      });
    }
  };

  const uncomplete = (task: Task) =>
    mutations.update.mutateAsync({
      id: task.id,
      patch: { done: false, completed_at: null },
    });

  const snooze = (task: Task, untilISO: string) =>
    mutations.update.mutateAsync({
      id: task.id,
      patch: { snoozed_until: untilISO },
    });

  return { query, open, done, snoozed, ...mutations, complete, uncomplete, snooze };
}

// ------------------------------------------------------------ deadlines
export function useDeadlines() {
  const query = useEntityList("deadlines");
  const base = useEntityMutations("deadlines");

  const sorted = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [query.data],
  );

  // Wrap mutations so local reminders track the row (spec §7.4).
  const add = {
    ...base.add,
    mutateAsync: async (row: Parameters<typeof base.add.mutateAsync>[0]) => {
      const created = await base.add.mutateAsync(row);
      void scheduleDeadlineReminders(created as Deadline);
      return created;
    },
  };
  const update = {
    ...base.update,
    mutateAsync: async (vars: Parameters<typeof base.update.mutateAsync>[0]) => {
      const updated = (await base.update.mutateAsync(vars)) as Deadline;
      void scheduleDeadlineReminders(updated);
      return updated;
    },
  };
  const remove = {
    ...base.remove,
    mutateAsync: async (id: string) => {
      await base.remove.mutateAsync(id);
      void cancelDeadlineReminders(id);
    },
  };

  return { query, sorted, add, update, remove };
}

// ----------------------------------------------- exams / papers / goals…
export function useExams() {
  const query = useEntityList("exams");
  const mutations = useEntityMutations("exams");
  const upcoming = useMemo(
    () =>
      [...(query.data ?? [])]
        .filter((e) => e.date >= todayISO())
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [query.data],
  );
  const past = useMemo(
    () =>
      [...(query.data ?? [])]
        .filter((e) => e.date < todayISO())
        .sort((a, b) => (a.date > b.date ? -1 : 1)),
    [query.data],
  );
  return { query, upcoming, past, ...mutations };
}

export function usePapers(subjectId?: string | null) {
  const query = useEntityList("papers");
  const mutations = useEntityMutations("papers");
  const papers = useMemo(() => {
    const all = query.data ?? [];
    const filtered = subjectId ? all.filter((p) => p.subject_id === subjectId) : all;
    return [...filtered].sort((a, b) =>
      (a.taken_on ?? a.created_at) < (b.taken_on ?? b.created_at) ? -1 : 1,
    );
  }, [query.data, subjectId]);
  return { query, papers, ...mutations };
}

export function useGoals() {
  const query = useEntityList("goals");
  const mutations = useEntityMutations("goals");
  const toggle = (goal: Goal) =>
    mutations.update.mutateAsync({
      id: goal.id,
      patch: goal.done
        ? { done: false, completed_at: null }
        : { done: true, completed_at: new Date().toISOString() },
    });
  return { query, ...mutations, toggle };
}

export function usePortfolio() {
  const query = useEntityList("portfolio_entries");
  const mutations = useEntityMutations("portfolio_entries");
  return { query, ...mutations };
}

export function useActivities() {
  const query = useEntityList("activities");
  const mutations = useEntityMutations("activities");
  return { query, ...mutations };
}

export function useActivityEvents(activityId?: string) {
  const query = useEntityList("activity_events");
  const mutations = useEntityMutations("activity_events");
  const events = useMemo(
    () =>
      (query.data ?? [])
        .filter((e) => !activityId || e.activity_id === activityId)
        .sort((a, b) => ((a.date ?? a.created_at) > (b.date ?? b.created_at) ? -1 : 1)),
    [query.data, activityId],
  );
  return { query, events, ...mutations };
}

// ------------------------------------------------------ topic confidence
export function useTopicConfidence(subjectId: string) {
  const query = useEntityList("topic_confidence");
  const mutations = useEntityMutations("topic_confidence");
  const topics = useMemo(
    () =>
      (query.data ?? [])
        .filter((t) => t.subject_id === subjectId)
        .sort((a, b) => (a.topic < b.topic ? -1 : 1)),
    [query.data, subjectId],
  );

  /** Honour the (user, subject, topic) uniqueness without a DB round-trip. */
  const upsert = async (topic: string, confidence: number) => {
    const existing = (query.data ?? []).find(
      (t) => t.subject_id === subjectId && t.topic.toLowerCase() === topic.toLowerCase(),
    );
    if (existing) {
      await mutations.update.mutateAsync({
        id: existing.id,
        patch: { confidence, updated_at: new Date().toISOString() },
      });
    } else {
      await mutations.add.mutateAsync({
        subject_id: subjectId,
        topic,
        confidence,
      });
    }
  };

  return { query, topics, upsert, remove: mutations.remove };
}

// -------------------------------------------------------- study sessions
export function useStudySessions() {
  const query = useEntityList("study_sessions");
  const mutations = useEntityMutations("study_sessions");
  const log = (minutes: number, subjectId?: string | null, taskId?: string | null) =>
    mutations.add.mutateAsync({
      minutes,
      subject_id: subjectId ?? null,
      task_id: taskId ?? null,
      started_at: new Date(Date.now() - minutes * 60_000).toISOString(),
      completed_at: new Date().toISOString(),
    });
  return { query, ...mutations, log };
}

// ----------------------------------------------------------- gamification
export function useGamification() {
  const tasks = useEntityList("tasks");
  const sessions = useEntityList("study_sessions");
  const papers = useEntityList("papers");

  return useMemo(() => {
    const t = tasks.data ?? [];
    const s = sessions.data ?? [];
    const p = papers.data ?? [];
    const xp = totalXp({
      tasksCompleted: t.filter((x) => x.done).length,
      studyMinutes: s.reduce((acc, x) => acc + x.minutes, 0),
      papersLogged: p.length,
    });
    const level = levelForXp(xp);
    const streak = streakDays(activityDateSet(t, s));
    const week = weeklySummary(t, s, p);
    const next = doNext(t);
    return { xp, level, streak, week, doNext: next, loaded: !tasks.isPending };
  }, [tasks.data, sessions.data, papers.data, tasks.isPending]);
}

// -------------------------------------------------------- subject health
export function useSubjectHealthMap(): Map<string, SubjectHealth> {
  const papers = useEntityList("papers");
  const confidence = useEntityList("topic_confidence");
  const { active } = useSubjects();

  return useMemo(() => {
    const map = new Map<string, SubjectHealth>();
    for (const subject of active) {
      map.set(
        subject.id,
        subjectHealth(
          (papers.data ?? []).filter((p) => p.subject_id === subject.id),
          (confidence.data ?? []).filter((c) => c.subject_id === subject.id),
        ),
      );
    }
    return map;
  }, [active, papers.data, confidence.data]);
}

// --------------------------------------------------------------- timeline
export type TimelineItem =
  | { kind: "task"; date: string; task: Task }
  | { kind: "deadline"; date: string; deadline: Deadline }
  | { kind: "exam"; date: string; exam: Exam }
  | { kind: "event"; date: string; event: CalendarEvent };

export function useTimeline(subjectFilter?: string | null) {
  const tasks = useEntityList("tasks");
  const deadlines = useEntityList("deadlines");
  const exams = useEntityList("exams");
  const events = useEntityList("calendar_events");

  const items = useMemo<TimelineItem[]>(() => {
    const out: TimelineItem[] = [];
    for (const t of tasks.data ?? []) {
      if (t.due_date && !t.done && (!subjectFilter || t.subject_id === subjectFilter)) {
        out.push({ kind: "task", date: t.due_date, task: t });
      }
    }
    for (const d of deadlines.data ?? []) {
      if (!subjectFilter || d.subject_id === subjectFilter) {
        out.push({ kind: "deadline", date: d.date, deadline: d });
      }
    }
    for (const e of exams.data ?? []) {
      if (!subjectFilter || e.subject_id === subjectFilter) {
        out.push({ kind: "exam", date: e.date, exam: e });
      }
    }
    if (!subjectFilter) {
      for (const ev of events.data ?? []) {
        out.push({
          kind: "event",
          date: ev.starts_at.slice(0, 10),
          event: ev,
        });
      }
    }
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }, [tasks.data, deadlines.data, exams.data, events.data, subjectFilter]);

  const isPending =
    tasks.isPending || deadlines.isPending || exams.isPending || events.isPending;

  return { items, isPending };
}

// -------------------------------------------------------- daily motivation
const OFFLINE_LINES = [
  "Small steps. Loud results.",
  "Revision is just future bragging rights.",
  "One past paper beats three highlighters.",
  "You don't need motivation, you need 25 minutes.",
  "Confidence is a by-product of receipts.",
  "Do the hard subject first. Thank yourself at 9pm.",
  "Streaks are built one unglamorous day at a time.",
];

/** Today's one-liner: server row when authed, seeded local line in guest. */
export function useMotivation() {
  const backend = useBackend();
  const scope = useDataScope();
  const today = todayISO();

  return useQuery({
    queryKey: [scope, "motivation", today],
    queryFn: async (): Promise<string> => {
      const rows = await backend.list("daily_motivations");
      const todayRow = rows.find((r) => r.date === today);
      if (todayRow) return todayRow.text;
      // deterministic per-day pick; cached so it never "regenerates on load"
      const seed = Number(today.replaceAll("-", "")) % OFFLINE_LINES.length;
      return OFFLINE_LINES[seed] ?? OFFLINE_LINES[0]!;
    },
    staleTime: 1000 * 60 * 60, // refetch at most hourly; key rotates daily
  });
}

// ----------------------------------------------------------- invalidation
export function useInvalidateScope() {
  const queryClient = useQueryClient();
  const scope = useDataScope();
  return () => queryClient.invalidateQueries({ queryKey: [scope] });
}

export { entityKey };
