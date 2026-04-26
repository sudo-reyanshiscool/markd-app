import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock, Plus, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { plannerOrder, pickDoNext, nextExam, levelFromXp, totalXP, DAILY_PLANNER_LIMIT } from "@/lib/domain";
import { fmtMinutes, daysUntil, relativeDay } from "@/lib/format";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { spring, fadeUp, stagger } from "@/lib/motion";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late one";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export function Today() {
  const data = useStore((s) => s.data);
  const toggle = useStore((s) => s.toggleTask);
  const planner = useMemo(() => plannerOrder(data.tasks).slice(0, DAILY_PLANNER_LIMIT), [data.tasks]);
  const doNext = useMemo(() => pickDoNext(data.tasks), [data.tasks]);
  const exam = useMemo(() => nextExam(data.exams), [data.exams]);
  const xp = useMemo(() => totalXP(data), [data]);
  const lvl = levelFromXp(xp);
  const subjectById = useMemo(
    () => new Map(data.subjects.map((s) => [s.id, s])),
    [data.subjects],
  );

  const today = new Date();
  const dayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const hasAnything = data.tasks.length || data.exams.length || data.subjects.length;

  return (
    <div className="space-y-12">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">{dayLabel}</p>
          <h1 className="display mt-2 text-[44px] leading-[1.04] tracking-[-0.02em]">
            {greeting()}.
          </h1>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <Badge tone="accent" dot>Level {lvl.level}</Badge>
          <div className="flex flex-col items-end">
            <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-3)]">XP</span>
            <span className="font-medium text-[var(--ink)]">{xp}</span>
          </div>
          <div className="h-9 w-32 overflow-hidden rounded-full border border-[var(--line)] bg-[var(--surface-2)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${lvl.pct}%` }}
              transition={spring.soft}
              className="h-full bg-[var(--accent)]"
            />
          </div>
        </div>
      </header>

      {!hasAnything ? (
        <EmptyState
          icon={<Sparkles size={18} />}
          title="A blank slate, the kind that's promising."
          description="Add a subject or two, drop in upcoming exams, and Markd will start picking your next move."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link to="/subjects">
                <Button variant="primary" iconLeft={<Plus size={15} />}>
                  Add a subject
                </Button>
              </Link>
              <Link to="/exams">
                <Button>Add an exam</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            {doNext ? (
              <Card padded={false} className="overflow-hidden p-6">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <Sparkles size={14} />
                  <span className="text-[11px] uppercase tracking-[0.16em] font-medium">Do next</span>
                </div>
                <h2 className="display mt-3 text-[26px] leading-[1.15] tracking-[-0.01em]">
                  {doNext.title}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {doNext.subjectId && subjectById.get(doNext.subjectId) && (
                    <Badge>
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: subjectById.get(doNext.subjectId)!.color }}
                      />
                      {subjectById.get(doNext.subjectId)!.name}
                    </Badge>
                  )}
                  {doNext.due && <Badge tone={daysUntil(doNext.due)! <= 1 ? "warm" : "neutral"}>{relativeDay(doNext.due)}</Badge>}
                  {doNext.estimateMin && (
                    <Badge>
                      <Clock size={11} /> {fmtMinutes(doNext.estimateMin)}
                    </Badge>
                  )}
                </div>
                <div className="mt-6 flex gap-2">
                  <Button variant="primary" onClick={() => toggle(doNext.id)}>
                    Mark done
                  </Button>
                  <Link to="/timer">
                    <Button>Start timer</Button>
                  </Link>
                </div>
              </Card>
            ) : (
              <Card>
                <p className="text-[14px] text-[var(--ink-3)]">
                  No open task. Drop in a deadline or set a quick to-do.
                </p>
                <Link to="/tasks" className="mt-3 inline-block">
                  <Button iconLeft={<Plus size={15} />}>New task</Button>
                </Link>
              </Card>
            )}

            {exam ? (
              <Card>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)]">
                  Next exam
                </p>
                <h3 className="display mt-2 text-[22px] tracking-[-0.01em]">{exam.title}</h3>
                <div className="mt-3 flex items-baseline gap-3">
                  <span className="display text-[44px] tracking-tight text-[var(--accent)]">
                    {Math.max(0, daysUntil(exam.date) ?? 0)}
                  </span>
                  <span className="text-[13px] text-[var(--ink-3)]">days away</span>
                </div>
                <p className="mt-2 text-[13px] text-[var(--ink-3)]">
                  {new Date(exam.date).toLocaleDateString(undefined, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                {exam.subjectId && subjectById.get(exam.subjectId) && (
                  <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: subjectById.get(exam.subjectId)!.color }}
                    />
                    {subjectById.get(exam.subjectId)!.name}
                  </p>
                )}
              </Card>
            ) : (
              <Card>
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--ink-3)]">Exams</p>
                <p className="mt-2 text-[14px] text-[var(--ink-2)]">
                  Nothing scheduled yet. Add an exam to get a live countdown.
                </p>
                <Link to="/exams" className="mt-3 inline-block">
                  <Button>Add exam</Button>
                </Link>
              </Card>
            )}
          </section>

          <section>
            <SectionHeader
              title="Daily planner"
              hint={`${planner.length} of ${data.tasks.filter((t) => !t.done).length} open`}
              action={
                <Link to="/tasks" className="text-[13px] text-[var(--accent)] hover:underline inline-flex items-center gap-1">
                  All tasks <ArrowUpRight size={13} />
                </Link>
              }
            />
            {planner.length === 0 ? (
              <Card>
                <p className="text-[14px] text-[var(--ink-3)]">No open tasks. Sit with that for a moment.</p>
              </Card>
            ) : (
              <motion.ul
                variants={stagger}
                initial="initial"
                animate="animate"
                className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]"
              >
                {planner.map((t) => {
                  const subject = t.subjectId ? subjectById.get(t.subjectId) : undefined;
                  const dueIn = daysUntil(t.due);
                  return (
                    <motion.li key={t.id} variants={fadeUp} className="border-b border-[var(--line)] last:border-b-0">
                      <button
                        onClick={() => toggle(t.id)}
                        className="group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <span
                          className="grid h-5 w-5 place-items-center rounded-full border-2 border-[var(--line-strong)] transition-colors group-hover:border-[var(--accent)]"
                          aria-hidden
                        />
                        <span className="flex-1 truncate">
                          <span className="block font-medium text-[var(--ink)]">{t.title}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
                            {subject && (
                              <>
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ background: subject.color }}
                                />
                                {subject.name}
                                <span aria-hidden>·</span>
                              </>
                            )}
                            {t.due ? relativeDay(t.due) : "no due date"}
                            {t.estimateMin && (
                              <>
                                <span aria-hidden>·</span>
                                {fmtMinutes(t.estimateMin)}
                              </>
                            )}
                          </span>
                        </span>
                        {t.priority === "urgent" && <Badge tone="danger" dot>Urgent</Badge>}
                        {t.priority === "soon" && dueIn !== null && dueIn <= 2 && (
                          <Badge tone="warm" dot>Soon</Badge>
                        )}
                      </button>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
