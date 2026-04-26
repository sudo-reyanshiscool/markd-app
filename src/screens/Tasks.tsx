import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { plannerOrder } from "@/lib/domain";
import { fmtMinutes, relativeDay, daysUntil } from "@/lib/format";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { fadeUp, spring, stagger } from "@/lib/motion";
import type { Priority } from "@/lib/types";

type Filter = "open" | "today" | "done" | "all";

export function Tasks() {
  const data = useStore((s) => s.data);
  const add = useStore((s) => s.addTask);
  const toggle = useStore((s) => s.toggleTask);
  const remove = useStore((s) => s.removeTask);

  const [filter, setFilter] = useState<Filter>("open");
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [priority, setPriority] = useState<Priority>("soon");
  const [due, setDue] = useState("");
  const [estimate, setEstimate] = useState("30");

  const subjectsById = useMemo(
    () => new Map(data.subjects.map((s) => [s.id, s])),
    [data.subjects],
  );

  const filtered = useMemo(() => {
    const ranked = plannerOrder(data.tasks);
    switch (filter) {
      case "today": {
        const today = ranked.filter((t) => {
          const d = daysUntil(t.due);
          return d !== null && d <= 0;
        });
        return today;
      }
      case "done":
        return data.tasks.filter((t) => t.done);
      case "all":
        return [...data.tasks].sort((a, b) =>
          a.done === b.done ? 0 : a.done ? 1 : -1,
        );
      default:
        return ranked;
    }
  }, [data.tasks, filter]);

  const counts = useMemo(
    () => ({
      open: data.tasks.filter((t) => !t.done).length,
      today: data.tasks.filter((t) => {
        const d = daysUntil(t.due);
        return !t.done && d !== null && d <= 0;
      }).length,
      done: data.tasks.filter((t) => t.done).length,
      all: data.tasks.length,
    }),
    [data.tasks],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    add({
      title: title.trim(),
      subjectId: subjectId || undefined,
      priority,
      due: due || undefined,
      estimateMin: Number.parseInt(estimate, 10) || undefined,
    });
    setTitle("");
    setDue("");
    setOpen(false);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Tasks</p>
          <h1 className="display mt-1 text-[36px] tracking-[-0.02em]">What's on the desk</h1>
        </div>
        <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setOpen(true)}>
          New task
        </Button>
      </header>

      <Tabs
        value={filter}
        onChange={(k) => setFilter(k as Filter)}
        items={[
          { key: "open", label: "Open", count: counts.open },
          { key: "today", label: "Today", count: counts.today },
          { key: "done", label: "Done", count: counts.done },
          { key: "all", label: "All", count: counts.all },
        ]}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={18} />}
          title={filter === "done" ? "Nothing finished here yet." : "Nothing on the list."}
          description={
            filter === "done"
              ? "Completed tasks will land here so you can see what's been moved."
              : "Drop in a single thing — Markd ranks the rest for you."
          }
          action={
            filter !== "done" && (
              <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setOpen(true)}>
                Add a task
              </Button>
            )
          }
        />
      ) : (
        <motion.ul
          variants={stagger}
          initial="initial"
          animate="animate"
          className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface)]"
        >
          <AnimatePresence initial={false}>
            {filtered.map((t) => {
              const subject = t.subjectId ? subjectsById.get(t.subjectId) : undefined;
              return (
                <motion.li
                  key={t.id}
                  variants={fadeUp}
                  layout
                  exit={{ opacity: 0, x: 8, transition: { duration: 0.18 } }}
                  transition={spring.soft}
                  className="border-b border-[var(--line)] last:border-b-0"
                >
                  <div className="group flex items-center gap-3 px-5 py-3.5">
                    <button
                      onClick={() => toggle(t.id)}
                      className={`grid h-5 w-5 place-items-center rounded-full border-2 transition-colors ${
                        t.done
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--line-strong)] hover:border-[var(--accent)]"
                      }`}
                      aria-label={t.done ? "Mark not done" : "Mark done"}
                    >
                      {t.done && <CheckCircle2 size={12} color="var(--accent-ink)" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`truncate text-[14.5px] ${
                          t.done ? "text-[var(--ink-3)] line-through" : "text-[var(--ink)]"
                        }`}
                      >
                        {t.title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--ink-3)]">
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
                      </p>
                    </div>
                    {t.priority === "urgent" && !t.done && <Badge tone="danger" dot>Urgent</Badge>}
                    <IconButton
                      size="sm"
                      onClick={() => remove(t.id)}
                      className="opacity-0 group-hover:opacity-100 hover:!text-[var(--danger)]"
                      aria-label="Delete"
                    >
                      <Trash2 size={14} />
                    </IconButton>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </motion.ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New task">
        <form className="space-y-4" onSubmit={submit}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What's the next thing to do?"
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">— none —</option>
              {data.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              <option value="urgent">Urgent</option>
              <option value="soon">Soon</option>
              <option value="later">Later</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <Input
              label="Estimate (min)"
              type="number"
              min={5}
              max={300}
              step={5}
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add task
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
