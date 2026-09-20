import { cn } from "@/shared/lib";
import { STEP_META } from "./model";

export interface StepperProps {
  current: number;
  onSelect: (step: number) => void;
}

/**
 * Port of design-reference.html's `.stepper`/`.stp` pattern. The reference
 * markup is display-only (no click handler); this adds click-to-go-back
 * navigation on top, restricted to steps already reached.
 */
export function Stepper({ current, onSelect }: StepperProps) {
  return (
    <div className="grid grid-cols-2 gap-px bg-line shadow-[0_0_0_1px_var(--line)] sm:grid-cols-4">
      {STEP_META.map(({ step, label, title }) => {
        const active = step === current;
        const reachable = step <= current;
        return (
          <button
            key={step}
            type="button"
            disabled={!reachable}
            aria-current={active ? "step" : undefined}
            onClick={() => onSelect(step)}
            className={cn(
              "flex flex-col gap-1.5 px-4 py-3.5 text-left transition-colors",
              active ? "bg-primary-100 text-ink" : "bg-white text-ink",
              !active && reachable && "cursor-pointer hover:bg-wash",
              !reachable && "cursor-not-allowed",
            )}
          >
            <span
              className={cn(
                "font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em]",
                active ? "text-ink/60" : "text-soft",
              )}
            >
              {label}
            </span>
            <b className="text-base font-normal tracking-tight">{title}</b>
          </button>
        );
      })}
    </div>
  );
}
