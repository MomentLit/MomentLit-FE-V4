"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import type { SearchMode } from "../lib/constants";

interface SearchModeTabsProps {
  mode: SearchMode;
  onChange: (mode: SearchMode) => void;
  /** 지금 보고 있는 탭의 결과 수 — 다른 탭은 걸린 필터와 맞지 않는 숫자가 되므로 붙이지 않는다. */
  count: number;
}

const MODE_ITEMS: { key: SearchMode; label: string }[] = [
  { key: "space", label: "공간" },
  { key: "popup", label: "팝업" },
];

/**
 * 결과 맨 위의 "공간 / 팝업" 탭 — 결과 제목 자리를 겸한다. 고른 탭만 진하게 + 굵은 밑줄을 긋고,
 * 다른 탭은 회색으로 둔다. 탭을 바꾸면 밑줄이 옆 탭으로 미끄러진다.
 */
export function SearchModeTabs({ mode, onChange, count }: SearchModeTabsProps) {
  const tabRefs = useRef<Partial<Record<SearchMode, HTMLButtonElement | null>>>({});
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);

  // 글자 폭이 탭마다 달라서 고른 탭의 실제 위치·폭을 재서 밑줄을 맞춘다(개수가 바뀌어도 다시 잰다).
  useLayoutEffect(() => {
    const tab = tabRefs.current[mode];
    if (!tab) return;
    const next = { left: tab.offsetLeft, width: tab.offsetWidth };
    setBar((prev) => (prev && prev.left === next.left && prev.width === next.width ? prev : next));
  }, [mode, count]);

  return (
    <div role="tablist" aria-label="검색 대상" className="relative flex items-end gap-6 pb-2">
      {MODE_ITEMS.map((item) => {
        const active = mode === item.key;
        return (
          <button
            key={item.key}
            ref={(node) => {
              tabRefs.current[item.key] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={cn(
              "section-title inline-flex items-baseline gap-1.5 whitespace-nowrap transition-colors",
              active ? "text-ink" : "text-soft/70 hover:text-ink",
            )}
          >
            {item.label}
            {active && <span className="text-[0.7em] font-bold tabular-nums text-main-d">{count}</span>}
          </button>
        );
      })}
      <span
        aria-hidden
        className="absolute bottom-0 h-[3px] bg-ink transition-[left,width] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none"
        style={bar ? { left: bar.left, width: bar.width } : { left: 0, width: 0 }}
      />
    </div>
  );
}
