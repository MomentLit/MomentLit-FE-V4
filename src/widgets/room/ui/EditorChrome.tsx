"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { IconChevronDown, IconLayoutSidebarRightCollapse, IconLayoutSidebarRightExpand, type IconProps } from "@tabler/icons-react";
import { cn } from "@/shared/lib";

/** 3D 방 화면들(파노라마·도면 방 만들기, 3D 보기)이 같이 쓰는 편집 화면 부품 — 왼쪽 도구 막대, 접는 정보 칸, 정보 칸 접기 버튼. */

export type ToolIcon = ComponentType<IconProps>;

/** 도구 막대 버튼 — 아이콘만 보이고, 마우스를 올리면(또는 키보드로 가면) 오른쪽에 이름이 뜬다. */
export function RailButton({ label, icon: Icon, active = false, disabled = false, onClick }: {
  label: string;
  icon: ToolIcon;
  /** 켜진 도구(눌린 상태). 한 번 실행하는 동작이면 생략. */
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "group relative flex size-9 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        active ? "bg-ink text-white" : "text-ink hover:bg-wash",
      )}
    >
      <Icon size={18} stroke={1.8} aria-hidden />
      <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-2 hidden -translate-y-1/2 whitespace-nowrap bg-ink px-2 py-1 text-xs font-medium text-white group-hover:block group-focus-visible:block">
        {label}
      </span>
    </button>
  );
}

/** 도구 막대 칸 나눔선. */
export function RailDivider() {
  return <span className="mx-1.5 my-1 h-px bg-line" aria-hidden />;
}

/** 화면 왼쪽 위에 뜨는 세로 도구 막대. */
export function ToolRail({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      aria-orientation="vertical"
      className={cn("absolute left-3 top-3 z-10 flex flex-col border border-line bg-white shadow-[0_2px_10px_rgba(21,23,28,.12)]", className)}
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
