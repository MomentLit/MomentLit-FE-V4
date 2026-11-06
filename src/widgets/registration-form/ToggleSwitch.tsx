import { cn } from "@/shared/lib";

/** 폼 안의 켜고 끄는 스위치(구역별 소개, 가격 문의 등) — 라벨이 붙은 작은 각진 버튼. */
export function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-2 px-3 text-[0.8rem] font-bold text-ink transition-[background-color,box-shadow]",
        checked
          ? "bg-sky shadow-[inset_0_0_0_1.5px_var(--ink)]"
          : "bg-white shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink)]",
      )}
    >
      <span aria-hidden className={cn("relative h-3.5 w-6 transition-colors", checked ? "bg-ink" : "bg-line")}>
        <span className={cn("absolute top-0.5 h-2.5 w-2.5 bg-white transition-[left]", checked ? "left-3" : "left-0.5")} />
      </span>
      {label}
    </button>
  );
}
