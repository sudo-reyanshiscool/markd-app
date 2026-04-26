import { motion } from "framer-motion";

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-[13px] text-[var(--ink-3)]">
      <motion.span
        className="h-2 w-2 rounded-full bg-[var(--accent)]"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.span
        className="h-2 w-2 rounded-full bg-[var(--accent)]"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.18 }}
      />
      <motion.span
        className="h-2 w-2 rounded-full bg-[var(--accent)]"
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.36 }}
      />
      <span className="ml-1 uppercase tracking-[0.12em]">{label}</span>
    </div>
  );
}

export function ErrorState({
  title = "Something went off course",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-6">
      <h3 className="display text-[18px] text-[var(--danger)]">{title}</h3>
      {message && <p className="mt-1 text-[14px] text-[var(--ink-2)]">{message}</p>}
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 text-[13px] font-medium text-[var(--accent)] hover:underline"
        >
          Try again →
        </button>
      )}
    </div>
  );
}
