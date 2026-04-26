import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { spring } from "@/lib/motion";

const PRESETS = [25, 45, 60];

export function Timer() {
  const subjects = useStore((s) => s.data.subjects);
  const log = useStore((s) => s.logStudySession);
  const recent = useStore((s) => s.data.studySessions.slice(0, 4));

  const [target, setTarget] = useState(25);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const startedRef = useRef<string | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= target * 60) {
          window.clearInterval(tickRef.current!);
          setRunning(false);
          finish(target * 60);
          return target * 60;
        }
        return e + 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, target]);

  const finish = (seconds: number) => {
    const minutes = Math.round(seconds / 60);
    if (minutes <= 0) return;
    log({
      minutes,
      subjectId: subjectId || undefined,
      startedAt: startedRef.current ?? new Date().toISOString(),
    });
    startedRef.current = null;
    setElapsed(0);
  };

  const start = () => {
    if (!startedRef.current) startedRef.current = new Date().toISOString();
    setRunning(true);
  };

  const stop = () => {
    setRunning(false);
    if (elapsed >= 60) finish(elapsed);
    setElapsed(0);
    startedRef.current = null;
  };

  const reset = () => {
    setRunning(false);
    setElapsed(0);
    startedRef.current = null;
  };

  const remaining = Math.max(0, target * 60 - elapsed);
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const pct = (elapsed / (target * 60)) * 100;
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));

  return (
    <div className="space-y-10">
      <header>
        <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Timer</p>
        <h1 className="display mt-1 text-[36px] tracking-[-0.02em]">Quiet focus</h1>
      </header>

      <Card padded={false} className="overflow-hidden">
        <div className="grid gap-8 p-10 md:grid-cols-[auto_1fr] md:items-center">
          <div className="relative h-56 w-56 mx-auto">
            <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
              <circle
                cx="100"
                cy="100"
                r="86"
                stroke="var(--line)"
                strokeWidth="8"
                fill="none"
              />
              <motion.circle
                cx="100"
                cy="100"
                r="86"
                stroke="var(--accent)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 86}
                animate={{
                  strokeDashoffset: 2 * Math.PI * 86 * (1 - pct / 100),
                }}
                transition={spring.soft}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="display text-[56px] leading-none tracking-tight tabular-nums text-[var(--ink)]">
                  {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-3)]">
                  {running ? "Focusing" : pct >= 100 ? "Done" : "Ready"}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    if (running) return;
                    setTarget(p);
                    setElapsed(0);
                  }}
                  disabled={running}
                  className={`rounded-[10px] border px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                    target === p
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "border-[var(--line)] hover:border-[var(--line-strong)] text-[var(--ink-2)]"
                  }`}
                >
                  {p} min
                </button>
              ))}
            </div>

            <div className="mt-4">
              <label className="block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)] mb-1.5">
                Subject
              </label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={running}
                className="h-11 w-full rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
              >
                <option value="">— focus session —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {!running ? (
                <Button variant="primary" iconLeft={<Play size={15} />} onClick={start}>
                  {elapsed > 0 ? "Resume" : "Start"}
                </Button>
              ) : (
                <Button variant="primary" iconLeft={<Pause size={15} />} onClick={() => setRunning(false)}>
                  Pause
                </Button>
              )}
              <Button iconLeft={<Square size={14} />} onClick={stop} disabled={elapsed === 0}>
                Stop & log
              </Button>
              <Button variant="ghost" iconLeft={<RotateCcw size={14} />} onClick={reset}>
                Reset
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-[12px] uppercase tracking-[0.12em] text-[var(--ink-3)] mb-3 px-1">
          Recent sessions
        </h2>
        {recent.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] p-6 text-center text-[14px] text-[var(--ink-3)]">
            No sessions logged yet — your first one will appear here.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]">
            {recent.map((s) => {
              const subject = s.subjectId ? subjectsById.get(s.subjectId) : undefined;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3 last:border-b-0"
                >
                  <div>
                    <p className="text-[14.5px] text-[var(--ink)]">
                      {subject ? subject.name : "Focus session"}
                    </p>
                    <p className="text-[12px] text-[var(--ink-3)]">
                      {new Date(s.startedAt).toLocaleString(undefined, {
                        weekday: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge tone="accent">{s.minutes}m</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
