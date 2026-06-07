import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { fadeUp, stagger } from "@/lib/motion";
import type { Goal } from "@/lib/types";

const HORIZONS: Goal["horizon"][] = ["3 months", "6 months", "9 months", "12 months"];

export function Goals() {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsertGoal);
  const toggle = useStore((s) => s.toggleGoal);
  const remove = useStore((s) => s.removeGoal);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<Goal["horizon"]>("3 months");
  const [subjectId, setSubjectId] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    upsert({ title: title.trim(), horizon, subjectId: subjectId || undefined, notes });
    setTitle("");
    setNotes("");
    setOpen(false);
  };

  const grouped = useMemo(() => {
    const m = new Map<Goal["horizon"], Goal[]>();
    for (const h of HORIZONS) m.set(h, []);
    data.goals.forEach((g) => m.get(g.horizon)?.push(g));
    return m;
  }, [data.goals]);

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Goals</p>
          <h1 className="display mt-1 text-[28px] tracking-[-0.02em] md:text-[36px]">The longer view</h1>
        </div>
        <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setOpen(true)}>
          New goal
        </Button>
      </header>

      {data.goals.length === 0 ? (
        <EmptyState
          icon={<LineChart size={18} />}
          title="No goals set."
          description="Set targets across 3, 6, 9 and 12 months — they nudge weekly tasks in the right direction."
          action={
            <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setOpen(true)}>
              Set a goal
            </Button>
          }
        />
      ) : (
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid gap-6 md:grid-cols-2"
        >
          {HORIZONS.map((h) => {
            const list = grouped.get(h) ?? [];
            return (
              <motion.section variants={fadeUp} key={h}>
                <h2 className="mb-2 px-1 text-[12px] uppercase tracking-[0.12em] text-[var(--ink-3)]">
                  {h}
                </h2>
                {list.length === 0 ? (
                  <Card className="text-[13px] text-[var(--ink-3)]">Nothing set for this horizon.</Card>
                ) : (
                  <ul className="space-y-2">
                    {list.map((g) => (
                      <li key={g.id}>
                        <Card padded={false} className="group flex items-start gap-3 p-4">
                          <button
                            onClick={() => toggle(g.id)}
                            className={`mt-0.5 grid h-5 w-5 place-items-center rounded-full border-2 transition-colors ${
                              g.done
                                ? "border-[var(--accent)] bg-[var(--accent)]"
                                : "border-[var(--line-strong)] hover:border-[var(--accent)]"
                            }`}
                            aria-label={g.done ? "Mark incomplete" : "Mark complete"}
                          />
                          <div className="flex-1">
                            <p
                              className={`text-[14.5px] ${
                                g.done ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"
                              }`}
                            >
                              {g.title}
                            </p>
                            {g.notes && (
                              <p className="mt-1 text-[12px] text-[var(--ink-3)]">{g.notes}</p>
                            )}
                          </div>
                          {g.done && <Badge tone="success">Done</Badge>}
                          <IconButton
                            size="sm"
                            onClick={() => remove(g.id)}
                            className="opacity-0 group-hover:opacity-100 hover:!text-[var(--danger)]"
                            aria-label="Remove goal"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            );
          })}
        </motion.div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New goal">
        <form className="space-y-4" onSubmit={submit}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Hit a Grade 8 mock in Mathematics"
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Horizon"
              value={horizon}
              onChange={(e) => setHorizon(e.target.value as Goal["horizon"])}
            >
              {HORIZONS.map((h) => (
                <option key={h}>{h}</option>
              ))}
            </Select>
            <Select label="Subject" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">— none —</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What success looks like."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Set goal
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
