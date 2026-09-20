import type { ReactNode } from "react";
import { cn } from "@/shared/lib";

export interface FormFieldProps {
  label: string;
  /** Spans both grid columns, matching design-reference.html's `.ff.full`. */
  full?: boolean;
  hint?: string;
  children: ReactNode;
}

/** Local port of design-reference.html's `.ff` (form field) pattern. */
export function FormField({ label, full, hint, children }: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", full && "sm:col-span-2")}>
      <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
        {label}
      </span>
      {children}
      {hint && <span className="text-[0.79rem] text-soft">{hint}</span>}
    </div>
  );
}

/**
 * Shared input/textarea/select styling — a literal string (not a component)
 * so it can be spread onto whichever element each step needs, mirroring
 * design-reference.html's `.ff input,.ff textarea,.ff select` rule.
 */
export const fieldInputClass =
  "w-full appearance-none rounded-none border-0 bg-transparent px-3.5 py-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--line)] outline-none transition-shadow placeholder:text-soft focus:shadow-[inset_0_0_0_1.5px_var(--sky)]";
