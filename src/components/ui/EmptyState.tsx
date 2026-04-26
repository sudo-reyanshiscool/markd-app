import { motion } from "framer-motion";
import { fadeUp, spring } from "@/lib/motion";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--line-strong)] bg-[var(--surface)] px-6 py-14 text-center"
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring.soft}
          className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-2)] text-[var(--ink-3)]"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="display text-[20px] text-[var(--ink)]">{title}</h3>
      {description && (
        <p className="max-w-sm text-[14px] leading-relaxed text-[var(--ink-3)]">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
