import { motion, type HTMLMotionProps } from "framer-motion";
import { spring } from "@/lib/motion";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface Props extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  variant?: Variant;
  size?: Size;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-[8px]",
  md: "h-10 px-4 text-[14px] gap-2 rounded-[10px]",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-[12px]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-[1.05] active:brightness-[0.95] shadow-[var(--shadow-sm)]",
  secondary:
    "bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--surface-3)] border border-[var(--line)]",
  ghost: "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]",
  danger:
    "bg-transparent text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)]",
};

export function Button({
  variant = "secondary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: Props) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -1 }}
      transition={spring.hover}
      className={cn(
        "inline-flex items-center justify-center select-none font-medium tracking-tight",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        fullWidth && "w-full",
        sizes[size],
        variants[variant],
        className,
      )}
      {...rest}
    >
      {iconLeft && <span className="grid place-items-center">{iconLeft}</span>}
      {children}
      {iconRight && <span className="grid place-items-center">{iconRight}</span>}
    </motion.button>
  );
}

export function IconButton({
  size = "md",
  className,
  children,
  ...rest
}: Omit<Props, "iconLeft" | "iconRight">) {
  const dim = size === "sm" ? "h-8 w-8" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      transition={spring.hover}
      className={cn(
        "grid place-items-center rounded-full text-[var(--ink-2)]",
        "hover:bg-[var(--surface-2)] hover:text-[var(--ink)] transition-colors",
        dim,
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
