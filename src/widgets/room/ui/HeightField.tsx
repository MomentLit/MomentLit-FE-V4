"use client";

import { useState, type KeyboardEvent } from "react";
import { fieldInputClass } from "@/widgets/registration-form/FormField";

/** 높이 입력 — 타이핑 중엔 자유롭게 두고, 칸을 벗어나거나 Enter를 누를 때 범위 안으로 맞춰 반영한다. */
export function HeightField({ label, value, min, max, onCommit, disabled, clamp = true }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  /** false면 범위를 벗어난 값도 그대로 넘긴다 — 부모가 이유를 알려 준다. */
  clamp?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);

  function commit() {
    if (text === null) return;
    const parsed = Number(text);
    setText(null);
    if (Number.isFinite(parsed) && parsed > 0) onCommit(clamp ? Math.max(min, Math.min(max, parsed)) : parsed);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={0.01}
          min={min}
          max={max}
          disabled={disabled}
          value={text ?? value.toFixed(2)}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={fieldInputClass}
        />
        <span className="text-soft">m</span>
      </span>
    </label>
  );
}

