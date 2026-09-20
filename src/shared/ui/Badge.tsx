import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic status color. Statuses reuse spectrum colors rather than owning dedicated ones (see ANALYSIS.md 2.7). */
  variant?: "approved" | "pending" | "rejected" | "neutral";
}

const VARIANT_CLASSES: Record<NonNullable<BadgeProps["variant"]>, string> = {
  approved: "bg-lime text-ink",
  pending: "bg-lemon text-ink",
  rejected: "bg-coral text-ink",
  neutral: "bg-wash text-soft",
};

/** Small status/label chip — e.g. 승인됨/승인 대기/거절됨. */
export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
