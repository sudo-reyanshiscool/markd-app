import { cn } from "./cn";

type Tone = "neutral" | "accent" | "warm" | "danger" | "success";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--ink-2)] border-[var(--line)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_24%,transparent)]",
  warm: "bg-[color-mix(in_srgb,var(--warmth)_18%,transparent)] text-[var(--warmth)] border-[color-mix(in_srgb,var(--warmth)_30%,transparent)]",
  danger:
    "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
  success:
    "bg-[color-mix(in_srgb,var(--success)_14%,transparent)] text-[var(--success)] border-[color-mix(in_srgb,var(--success)_28%,transparent)]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]",
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "currentColor", opacity: 0.85 }}
        />
      )}
      {children}
    </span>
  );
}
