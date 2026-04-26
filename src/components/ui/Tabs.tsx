import { motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { cn } from "./cn";

export interface TabItem {
  key: string;
  label: string;
  count?: number;
}

export function Tabs({
  items,
  value,
  onChange,
}: {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="relative inline-flex rounded-[12px] bg-[var(--surface-2)] p-1 border border-[var(--line)]">
      {items.map((it) => {
        const active = it.key === value;
        return (
          <button
            key={it.key}
            onClick={() => onChange(it.key)}
            className={cn(
              "relative z-10 px-3 h-8 inline-flex items-center gap-1.5 text-[13px] font-medium rounded-[8px] transition-colors",
              active ? "text-[var(--ink)]" : "text-[var(--ink-3)] hover:text-[var(--ink-2)]",
            )}
          >
            {active && (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-[8px] bg-[var(--surface)] shadow-[var(--shadow-sm)] border border-[var(--line)]"
                transition={spring.snappy}
              />
            )}
            <span className="relative">{it.label}</span>
            {typeof it.count === "number" && (
              <span className="relative text-[11px] text-[var(--ink-3)]">
                {it.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
