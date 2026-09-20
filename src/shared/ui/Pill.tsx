import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/shared/lib";

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Optional trailing count, e.g. category filter pills ("팝업스토어 214"). */
  count?: number;
}

/** Toggleable filter pill used for category/region filters. */
export function Pill({ active, count, className, children, ...props }: PillProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 border px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary-200 bg-primary-100 text-ink"
          : "border-line bg-white text-ink hover:border-line-2",
        className,
      )}
      {...props}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className={cn("text-xs", active ? "text-ink/70" : "text-soft")}>
          {count}
        </span>
      )}
    </button>
  );
}
