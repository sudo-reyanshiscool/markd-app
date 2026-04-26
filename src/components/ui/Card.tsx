import { motion, type HTMLMotionProps } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { cn } from "./cn";

interface Props extends Omit<HTMLMotionProps<"div">, "ref"> {
  interactive?: boolean;
  padded?: boolean;
}

export function Card({ interactive, padded = true, className, children, ...rest }: Props) {
  return (
    <motion.div
      variants={fadeUp}
      initial="initial"
      animate="animate"
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--surface)] border border-[var(--line)]",
        padded && "p-5",
        interactive &&
          "cursor-pointer transition-[transform,border-color] hover:border-[var(--line-strong)] hover:-translate-y-[1px]",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeader({
  title,
  action,
  hint,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-1">
      <div>
        <h2 className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--ink-3)]">
          {title}
        </h2>
        {hint && <p className="mt-0.5 text-[13px] text-[var(--ink-3)]">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
