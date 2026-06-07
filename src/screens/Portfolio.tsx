import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, Trophy } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card } from "@/components/ui/Card";
import { Button, IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { fadeUp, stagger } from "@/lib/motion";
import type { PortfolioItem } from "@/lib/types";

const TYPES: PortfolioItem["type"][] = ["Project", "Achievement", "Competition", "Leadership"];
const TONE: Record<PortfolioItem["type"], "accent" | "warm" | "success" | "neutral"> = {
  Project: "accent",
  Achievement: "success",
  Competition: "warm",
  Leadership: "neutral",
};

export function Portfolio() {
  const items = useStore((s) => s.data.portfolio);
  const upsert = useStore((s) => s.upsertPortfolio);
  const remove = useStore((s) => s.removePortfolio);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<PortfolioItem["type"]>("Project");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    upsert({ title: title.trim(), type, date: date || undefined, description });
    setTitle("");
    setDate("");
    setDescription("");
    setOpen(false);
  };

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[12px] uppercase tracking-[0.18em] text-[var(--ink-3)]">Portfolio</p>
          <h1 className="display mt-1 text-[28px] tracking-[-0.02em] md:text-[36px]">What you've made</h1>
        </div>
        <Button variant="primary" iconLeft={<Plus size={16} />} onClick={() => setOpen(true)}>
          New entry
        </Button>
      </header>

      {items.length === 0 ? (
        <EmptyState
          icon={<Trophy size={18} />}
          title="No entries yet."
          description="Capture projects, achievements, competitions and leadership moments — your future self will thank you."
          action={
            <Button variant="primary" iconLeft={<Plus size={15} />} onClick={() => setOpen(true)}>
              Add an entry
            </Button>
          }
        />
      ) : (
        <motion.ul
          variants={stagger}
          initial="initial"
          animate="animate"
          className="grid gap-3 md:grid-cols-2"
        >
          {items.map((p) => (
            <motion.li variants={fadeUp} key={p.id}>
              <Card padded={false} className="group p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={TONE[p.type]}>{p.type}</Badge>
                    <h3 className="mt-2 font-medium text-[16px] text-[var(--ink)]">{p.title}</h3>
                    {p.date && (
                      <p className="mt-0.5 text-[12px] text-[var(--ink-3)]">
                        {new Date(p.date).toLocaleDateString(undefined, {
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    )}
                    {p.description && (
                      <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <IconButton
                    onClick={() => remove(p.id)}
                    aria-label="Remove entry"
                    className="opacity-0 group-hover:opacity-100 hover:!text-[var(--danger)]"
                  >
                    <Trash2 size={14} />
                  </IconButton>
                </div>
              </Card>
            </motion.li>
          ))}
        </motion.ul>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="New entry">
        <form className="space-y-4" onSubmit={submit}>
          <Input
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Won regional maths challenge"
            required
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value as PortfolioItem["type"])}>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Textarea
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A line or two about what happened."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Add entry
            </Button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
