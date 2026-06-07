import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GraduationCap, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { subjectHealth } from "@/lib/domain";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Select } from "@/components/ui/Input";
import { CURRICULA, EXAM_BOARDS, PALETTE, type CurriculumKey } from "@/data/curricula";
import { fadeUp, spring, stagger } from "@/lib/motion";

const TONE_BY_LABEL = {
  "On track": "success",
  "Needs care": "warm",
  "At risk": "danger",
  Quiet: "neutral",
} as const;

export function Subjects() {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsertSubject);
  const remove = useStore((s) => s.removeSubject);
  const [open, setOpen] = useState(false);
  const [curriculum, setCurriculum] = useState<CurriculumKey>("GCSE");
  const [name, setName] = useState("");
  const [board, setBoard] = useState("AQA");
  const [target, setTarget] = useState("7");
  const [color, setColor] = useState(PALETTE[0]!);

  const reset = () => {
    setName("");
    setBoard(CURRICULA[curriculum].defaultBoard);
    setTarget(CURRICULA[curriculum].defaultTarget);
    setColor(PALETTE[(data.subjects.length) % PALETTE.length]!);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    upsert({ name: name.trim(), board, curriculum, color, targetGrade: target });
    setOpen(false);
    reset();
  };

  const grades = CURRICULA[curriculum].grades;

  const sorted = useMemo(
    () => [...data.subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [data.subjects],
  );

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Subjects</p>
          <h1 className="display mt-1 text-[28px] tracking-[-0.02em] md:text-[36px]">Your shelf</h1>
        </div>
        <Button
          variant="primary"
          iconLeft={<Plus size={16} />}
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          New subject
        </Button>
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<GraduationCap size={18} />}
          title="No subjects yet."
          description="Pick a curriculum and add a few subjects — boards and targets help Markd grade later."
          action={
            <Button
              variant="primary"
              iconLeft={<Plus size={15} />}
              onClick={() => {
                reset();
                setOpen(true);
              }}
            >
              Add your first subject
            </Button>
          }
        />
      ) : (
        <motion.ul
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2"
        >
          {sorted.map((subject) => {
            const health = subjectHealth(subject, data);
            const tone = TONE_BY_LABEL[health.label];
            return (
              <motion.li variants={fadeUp} key={subject.id}>
                <Card padded={false} className="group overflow-hidden">
                  <div className="flex items-start justify-between p-5">
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-1 h-7 w-1 rounded-full"
                        style={{ background: subject.color }}
                      />
                      <div>
                        <h3 className="font-medium text-[16px] text-[var(--ink)]">{subject.name}</h3>
                        <p className="text-[12px] text-[var(--ink-3)]">
                          {subject.curriculum} · {subject.board}
                          {subject.targetGrade && ` · target ${subject.targetGrade}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => remove(subject.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md text-[var(--ink-3)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)]"
                      aria-label="Remove subject"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="border-t border-[var(--line)] bg-[var(--surface-2)] px-5 py-3 flex items-center justify-between">
                    <Badge tone={tone}>{health.label}</Badge>
                    <div className="flex items-center gap-3 text-[12px] text-[var(--ink-3)]">
                      <span>{health.taskLoad} open</span>
                      <span aria-hidden>·</span>
                      <span>
                        {health.examPressure < 0
                          ? "no exam"
                          : `exam in ${health.examPressure}d`}
                      </span>
                      <div className="ml-1 h-1.5 w-16 overflow-hidden rounded-full bg-[var(--line)]">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${health.score}%` }}
                          transition={spring.soft}
                          className="h-full bg-[var(--accent)]"
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New subject">
        <form className="space-y-5" onSubmit={submit}>
          <Select
            label="Curriculum"
            value={curriculum}
            onChange={(e) => {
              const next = e.target.value as CurriculumKey;
              setCurriculum(next);
              setBoard(CURRICULA[next].defaultBoard);
              setTarget(CURRICULA[next].defaultTarget);
            }}
          >
            {(Object.keys(CURRICULA) as CurriculumKey[]).map((k) => (
              <option key={k} value={k}>
                {CURRICULA[k].label}
              </option>
            ))}
          </Select>

          <div>
            <span className="block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)] mb-1.5">
              Suggestions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {CURRICULA[curriculum].subjects.slice(0, 16).map((s) => (
                <button
                  type="button"
                  key={s.name}
                  onClick={() => {
                    setName(s.name);
                    setBoard(s.board);
                  }}
                  className="rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-[12px] text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Subject name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mathematics"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Board" value={board} onChange={(e) => setBoard(e.target.value)}>
              {EXAM_BOARDS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
            <Select label="Target grade" value={target} onChange={(e) => setTarget(e.target.value)}>
              {grades.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </div>

          <div>
            <span className="block text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)] mb-2">
              Colour
            </span>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-[var(--ink)]" : "border-transparent"
                  }`}
                  style={{ background: c }}
                  aria-label={`Pick ${c}`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add subject
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
