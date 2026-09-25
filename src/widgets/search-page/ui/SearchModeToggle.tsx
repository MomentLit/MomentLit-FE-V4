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
    <div className="relative flex w-[168px] rounded-md bg-sky p-0.5">
      <span
        className={cn(
          "absolute inset-y-0.5 left-0.5 w-[82px] bg-white shadow-[0_2px_5px_rgba(21,23,28,0.35)] transition-transform duration-200 ease-out",
          mode === "popup" && "translate-x-[82px]",
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
            "relative z-10 w-[82px] py-1.5 text-sm font-bold transition-colors",
            mode === item.key ? "text-ink" : "text-ink/55 hover:text-ink",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
