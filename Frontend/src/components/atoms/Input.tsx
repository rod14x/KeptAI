import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "../../lib/format";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, error, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      {...props}
      className={cx(
        "h-10 w-full rounded-md bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-muted outline-none transition-all",
        "border border-line focus:border-brand-blue focus:bg-card focus:ring-2 focus:ring-brand-blue/20",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-bad focus:border-bad focus:ring-bad/20",
        className
      )}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, error, rows = 3, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      {...props}
      className={cx(
        "w-full rounded-md bg-panel px-3.5 py-2.5 text-sm text-ink placeholder:text-muted outline-none transition-all",
        "border border-line focus:border-brand-blue focus:bg-card focus:ring-2 focus:ring-brand-blue/20",
        "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        error && "border-bad focus:border-bad focus:ring-bad/20",
        className
      )}
    />
  );
});
