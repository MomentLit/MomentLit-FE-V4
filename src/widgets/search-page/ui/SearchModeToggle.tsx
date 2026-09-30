"use client";

import { cn } from "@/shared/lib";
import type { SearchMode } from "../lib/constants";

interface SearchModeToggleProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
}

const MODE_ITEMS: { key: SearchMode; label: string }[] = [
  { key: "space", label: "공간" },
  { key: "popup", label: "팝업" },
];

/** 공간/팝업 스왑 — FilterPanel/PopupFilterPanel 맨 위에 얹어서 쓴다. */
export function SearchModeToggle({ mode, onChange }: SearchModeToggleProps) {
  return (
    <div className="relative flex w-full border border-ink bg-sky p-0.5">
      <span
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] bg-white transition-transform duration-200 ease-out",
          mode === "popup" && "translate-x-full",
        )}
        aria-hidden
      />
      {MODE_ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={mode === item.key}
          onClick={() => onChange(item.key)}
          className={cn(
            "relative z-10 flex-1 py-2.5 text-base font-bold transition-colors",
            mode === item.key ? "text-ink" : "text-ink/55 hover:text-ink",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
