"use client";

import { useId, useState, type ComponentType, type ReactNode } from "react";
import { IconChevronDown, IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, type IconProps } from "@tabler/icons-react";
import { cn } from "@/shared/lib";

/** 3D 방 화면들(파노라마·도면 방 만들기, 3D 보기)이 같이 쓰는 편집 화면 부품 — 왼쪽 도구 막대, 접는 정보 칸, 정보 칸 접기 버튼. */

export type ToolIcon = ComponentType<IconProps>;

/**
 * 도구 막대 버튼 — 아이콘 아래에 짧은 이름을 늘 보여 준다(좁은 화면에선 아이콘만).
 * 켜진 도구는 브랜드 파랑, 지금 쓰면 좋은 도구(`highlight`)는 파란 테두리와 '추천' 표시로 눈에 띄게.
 * 마우스를 올리면 오른쪽에 이름과 설명(`hint`)이 뜬다.
 */
export function RailButton({ label, caption, hint, icon: Icon, active = false, highlight = false, disabled = false, onClick }: {
  label: string;
  /** 아이콘 아래 짧은 이름(4~5자). 없으면 `label`. */
  caption?: string;
  /** 마우스를 올렸을 때 이름 아래 한 줄 설명. */
  hint?: string;
  icon: ToolIcon;
  /** 켜진 도구(눌린 상태). 한 번 실행하는 동작이면 생략. */
  active?: boolean;
  /** 지금 단계에서 쓰면 좋은 도구. */
  highlight?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const showHighlight = highlight && !active && !disabled;
  const hintId = useId();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      aria-describedby={hint ? hintId : undefined}
      className={cn(
        "group relative flex size-10 shrink-0 flex-col items-center justify-center gap-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-35 sm:h-14 sm:w-16",
        active
          ? "bg-[var(--main-d)] text-white"
          : showHighlight
            ? "bg-[var(--primary-100)] text-[var(--main-d)] ring-2 ring-inset ring-[var(--main-d)]"
            : "text-ink hover:bg-[var(--primary-50)] hover:text-[var(--main-d)]",
      )}
    >
      <Icon size={22} stroke={1.8} aria-hidden />
      <span className="hidden max-w-full truncate px-0.5 text-[0.66rem] font-semibold leading-none sm:block">{caption ?? label}</span>
      {showHighlight && (
        <span className="absolute right-0 top-0 bg-[var(--main-d)] px-1 py-px text-[0.56rem] font-bold leading-none text-white" aria-hidden>
          추천
        </span>
      )}
      <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-max max-w-[220px] -translate-y-1/2 flex-col gap-0.5 bg-ink px-2.5 py-1.5 text-left text-xs font-medium text-white group-hover:flex group-focus-visible:flex">
        <span className="font-semibold">{label}</span>
        {hint && <span id={hintId} className="font-normal leading-snug text-white/80">{hint}</span>}
      </span>
    </button>
  );
}

/** 도구 막대 칸 나눔선. */
export function RailDivider() {
  return <span className="mx-2 my-1 h-px bg-line" aria-hidden />;
}

/** 화면 왼쪽 위에 뜨는 세로 도구 막대. */
export function ToolRail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="vertical"
      className={cn("absolute bottom-3 left-3 top-3 z-10 flex h-fit max-h-[calc(100%-1.5rem)] flex-col border max-sm:overflow-y-auto border-line-2 bg-white p-1 shadow-[0_4px_16px_rgba(21,23,28,.16)]", className)}
    >
      {children}
    </div>
  );
}

/** 접을 수 있는 정보 칸. 접혀 있으면 제목 옆에 한 줄 요약을 보여 준다. */
export function PanelSection({ title, summary, defaultOpen = true, children }: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-wash"
        >
          <span className="shrink-0 text-sm font-bold text-ink">{title}</span>
          <span className="min-w-0 flex-1 truncate text-right text-xs text-soft">{!open && summary}</span>
          <IconChevronDown size={16} stroke={2} aria-hidden className={cn("shrink-0 text-soft transition-transform", open && "rotate-180")} />
        </button>
      </h2>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

/** 위쪽 막대의 '정보 접기/펼치기' 버튼. */
export function PanelToggleButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const label = open ? "정보 접기" : "정보 펼치기";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={open}
      aria-label={label}
      title={label}
      className="button button--outline button--sm button--icon"
    >
      {open
        ? <IconLayoutSidebarRightCollapse size={16} stroke={2} aria-hidden />
        : <IconLayoutSidebarRightExpand size={16} stroke={2} aria-hidden />}
    </button>
  );
}
