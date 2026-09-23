import type { HTMLAttributes } from "react";
import { cn } from "@/shared/lib";

export type SpectrumTone =
  | "sky"
  | "lime"
  | "lemon"
  | "coral"
  | "rose"
  | "violet";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * When set, the card renders as a flat color field (one of the 6-color
   * spectrum tokens) instead of a photo. Text on top of a color field must
   * always use the "ink" text rule — see globals.css `--color-ink`.
   */
  tone?: SpectrumTone;
}

// Written out as literal class names (rather than built with a template
// string) so Tailwind's static scanner can see and generate them.
const TONE_CLASSES: Record<SpectrumTone, string> = {
  sky: "bg-sky text-ink border-transparent",
  lime: "bg-lime text-ink border-transparent",
  lemon: "bg-lemon text-ink border-transparent",
  coral: "bg-coral text-ink border-transparent",
  rose: "bg-rose text-ink border-transparent",
  violet: "bg-violet text-ink border-transparent",
};

/**
 * Base surface primitive. Defaults to a neutral (wash/line) card; pass
 * `tone` for a color-field card that follows the ink-text rule.
 */
export function Card({ tone, className, style, children, ...props }: CardProps) {
  return (
    <div
      // NOTE: `bg-white` and the tone utilities (`bg-sky`, `bg-lime`, ...) must
      // never both be applied to the same element — Tailwind resolves classes
      // of equal specificity by their order in the generated stylesheet (not
      // by order in this class list), and `bg-white` sorts after the tone
      // utilities alphabetically, so it would silently always win.
      className={cn(
        "rounded-2xl border border-line",
        tone ? TONE_CLASSES[tone] : "bg-white",
        className,
      )}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}
