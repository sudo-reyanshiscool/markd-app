import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { daysUntil } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Select } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { fadeUp, stagger } from "@/lib/motion";

export function Exams() {
  const data = useStore((s) => s.data);
  const upsert = useStore((s) => s.upsertExam);
  const remove = useStore((s) => s.removeExam);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [duration, setDuration] = useState("90");
  const [paper, setPaper] = useState("");
  const [location, setLocation] = useState("");

  const sorted = useMemo(
    () =>
      [...data.exams].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [data.exams],
  );

  const subjectsById = useMemo(
    () => new Map(data.subjects.map((s) => [s.id, s])),
    [data.subjects],
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    upsert({
      title: title.trim(),
      date,
      subjectId: subjectId || undefined,
      durationMin: Number.parseInt(duration, 10) || undefined,
      paper: paper || undefined,
      location: location || undefined,
    });
    setTitle("");
    setDate("");
    setSubjectId("");
    setPaper("");
    setLocation("");
    setOpen(false);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Exams</p>
          <h1 className="display mt-1 text-[28px] tracking-[-0.02em] md:text-[36px]">The horizon</h1>
        </div>
        <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setOpen(true)}>
          New exam
        </Button>
      </header>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Calendar size={18} />}
          title="No exams scheduled."
          description="Add an exam date and Markd will keep a quiet countdown wherever you go."
          action={
            <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setOpen(true)}>
              Add an exam
            </Button>
          }
        />
      ) : (
        <motion.ul
          variants={stagger}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          {sorted.map((exam) => {
            const dleft = daysUntil(exam.date) ?? 0;
            const subject = exam.subjectId ? subjectsById.get(exam.subjectId) : undefined;
            const tone = dleft <= 7 ? "danger" : dleft <= 30 ? "warm" : "neutral";
            return (
              <motion.li variants={fadeUp} key={exam.id}>
                <Card padded={false} className="flex items-center justify-between p-5 group">
                  <div className="flex items-center gap-5">
                    <div className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 min-w-[64px]">
                      <span className="display text-[26px] leading-none tracking-tight text-[var(--ink)]">
                        {Math.max(0, dleft)}
                      </span>
                      <span className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--ink-3)]">
                        {dleft < 0 ? "passed" : dleft === 0 ? "today" : "days"}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-medium text-[16px] text-[var(--ink)]">{exam.title}</h3>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                        {new Date(exam.date).toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                        {exam.durationMin ? ` · ${exam.durationMin}m` : ""}
                        {exam.location ? ` · ${exam.location}` : ""}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {subject && (
                          <Badge>
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: subject.color }}
                            />
                            {subject.name}
                          </Badge>
                        )}
                        <Badge tone={tone} dot>
                          {dleft < 0 ? "Done" : dleft === 0 ? "Today" : `${dleft} days`}
                        </Badge>
                        {exam.paper && <Badge>{exam.paper}</Badge>}
                      </div>
                    </div>
                  </div>
                  <IconButton
                    onClick={() => remove(exam.id)}
                    aria-label="Remove exam"
                    className="opacity-0 group-hover:opacity-100 hover:!text-[var(--danger)]"
                  >
                    <Trash2 size={15} />
                  </IconButton>
                </Card>
              </motion.li>
            );
          })}
        </motion.ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New exam">
        <form className="space-y-4" onSubmit={submit}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Mathematics Paper 1"
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="Duration (min)"
              type="number"
              min={15}
              step={15}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Paper"
              value={paper}
              onChange={(e) => setPaper(e.target.value)}
              placeholder="Paper 1"
            />
            <Input
              label="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Sports hall"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add exam
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
