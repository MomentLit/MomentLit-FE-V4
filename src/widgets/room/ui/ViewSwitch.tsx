"use client";

import type { Icon } from "@tabler/icons-react";
import { cn } from "@/shared/lib";

export interface ViewOption<T extends string> {
  id: T;
  label: string;
  icon: Icon;
  disabled?: boolean;
}

/**
 * 시점 전환(사진 시점·미니어처·1인칭·도면) — 붙어 있는 칸(`.segmented`). 고른 칸만 바탕색이 바뀌어
 * 시점을 바꿔도 버튼 크기·위치가 그대로다. 3D 화면 위에 올릴 때는 `floating`으로 그림자를 준다.
 */
export function ViewSwitch<T extends string>({ options, value, onChange, floating = false, className }: {
  options: readonly ViewOption<T>[];
  value: T;
  onChange: (value: T) => void;
  floating?: boolean;
  className?: string;
}) {
  return (
    <div role="group" aria-label="시점" className={cn("segmented", floating && "shadow-[0_2px_10px_rgba(21,23,28,.18)]", className)}>
      {options.map(({ id, label, icon: OptionIcon, disabled }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          disabled={disabled}
          aria-pressed={value === id}
          className="segmented__item"
        >
          <OptionIcon size={15} stroke={2} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
