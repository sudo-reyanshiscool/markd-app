import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, className, id, ...rest },
  ref,
) {
  const inputId = id ?? label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
      {label && (
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">
          {label}
        </span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(
          "h-11 w-full rounded-[10px] bg-[var(--surface)] px-3.5 text-[15px]",
          "border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--ink-4)]",
          "outline-none transition-[border-color,box-shadow]",
          "focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
          error && "border-[var(--danger)]",
          className,
        )}
        {...rest}
      />
      {(hint || error) && (
        <span
          className={cn(
            "text-[12px]",
            error ? "text-[var(--danger)]" : "text-[var(--ink-3)]",
          )}
        >
          {error ?? hint}
        </span>
      )}
    </label>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, className, id, ...rest },
  ref,
) {
  const textareaId = id ?? label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="flex flex-col gap-1.5" htmlFor={textareaId}>
      {label && (
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">
          {label}
        </span>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        rows={3}
        className={cn(
          "min-h-[88px] w-full resize-y rounded-[10px] bg-[var(--surface)] p-3 text-[15px]",
          "border border-[var(--line)] text-[var(--ink)] placeholder:text-[var(--ink-4)]",
          "outline-none transition focus:border-[var(--accent)]",
          "focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
          className,
        )}
        {...rest}
      />
      {hint && <span className="text-[12px] text-[var(--ink-3)]">{hint}</span>}
    </label>
  );
});

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, className, id, children, ...rest },
  ref,
) {
  const selectId = id ?? label?.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="flex flex-col gap-1.5" htmlFor={selectId}>
      {label && (
        <span className="text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--ink-3)]">
          {label}
        </span>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(
          "h-11 w-full rounded-[10px] bg-[var(--surface)] px-3 text-[15px]",
          "border border-[var(--line)] text-[var(--ink)] outline-none transition",
          "focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_18%,transparent)]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
});
