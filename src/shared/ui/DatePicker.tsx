"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconCalendarEvent, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/shared/lib";

export interface DatePickerProps {
  /** ISO `YYYY-MM-DD`, or `""` for no date selected. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** ISO `YYYY-MM-DD` — dates before this are disabled. */
  min?: string;
  /** Underline under the trigger + highlight on the selected day — mirrors the hero's `.ml-pick` marker style. */
  accent?: string;
  className?: string;
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function parseISODate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value: string): string {
  const date = parseISODate(value);
  if (!date) return "";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Custom calendar popover — swaps in for a native `<input type="date">` so the picker matches the rest of the design system instead of the OS default. */
export function DatePicker({ value, onChange, placeholder, ariaLabel, min, accent = "var(--sky)", className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const selectedDate = parseISODate(value);
  const minDate = min ? parseISODate(min) : null;
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate ?? minDate ?? new Date()));

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function openPanel() {
    setViewMonth(startOfMonth(selectedDate ?? minDate ?? new Date()));
    setOpen((v) => !v);
  }

  function changeMonth(delta: number) {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const firstWeekday = viewMonth.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), i + 1)),
  ];
  const minIso = minDate ? toISODate(minDate) : null;

  // Same reasoning as shared/ui/Dropdown.tsx: span/button throughout (not
  // div/ul/li) so this still works when a caller nests it inside a <p>.
  return (
    <span
      ref={rootRef}
      className={`relative inline-block ${className ?? ""}`}
      style={{ "--pc": accent } as CSSProperties}
    >
      <button
        type="button"
        onClick={openPanel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1.5 px-[3px] py-[1px] pb-[3px] font-bold text-ink shadow-[inset_0_-0.28em_0_var(--pc)] transition-[box-shadow,color] duration-200 hover:shadow-[inset_0_-1.35em_0_var(--pc)]"
      >
        {value ? formatDisplay(value) : placeholder}
        <IconCalendarEvent size={16} stroke={2} aria-hidden />
      </button>

      {open && (
        <span
          role="dialog"
          aria-label={ariaLabel}
          className="date-picker-panel absolute left-0 top-[calc(100%+10px)] z-50 block w-[264px] border border-ink bg-white p-3 text-left shadow-[0_12px_28px_-8px_rgba(21,23,28,0.28)]"
        >
          <span className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="이전 달"
              className="grid h-6 w-6 place-items-center text-ink transition-colors hover:bg-wash"
            >
              <IconChevronLeft size={14} stroke={2} />
            </button>
            <span className="text-[0.85rem] font-bold text-ink">
              {viewMonth.getFullYear()}년 {viewMonth.getMonth() + 1}월
            </span>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="다음 달"
              className="grid h-6 w-6 place-items-center text-ink transition-colors hover:bg-wash"
            >
              <IconChevronRight size={14} stroke={2} />
            </button>
          </span>

          <span className="grid grid-cols-7 gap-[3px] text-center">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="block py-1 font-mono text-[0.63rem] text-soft">
                {label}
              </span>
            ))}
            {cells.map((date, i) => {
              if (!date) return <span key={`blank-${i}`} className="block" />;
              const iso = toISODate(date);
              const disabled = minIso ? iso < minIso : false;
              const isSelected = iso === value;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(iso);
                    setOpen(false);
                  }}
                  className={cn(
                    "aspect-square text-[0.78rem] transition-colors",
                    disabled && "text-soft/40",
                    !disabled && !isSelected && "text-ink hover:bg-wash",
                    isSelected && "font-bold text-ink",
                  )}
                  style={isSelected ? { background: "var(--pc)" } : undefined}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </span>

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-2 w-full text-center text-xs text-soft transition-colors hover:text-ink"
            >
              지우기
            </button>
          )}
        </span>
      )}

      <style>{`
        @keyframes date-picker-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }
        .date-picker-panel { animation: date-picker-in 0.16s cubic-bezier(0.2, 0.85, 0.25, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .date-picker-panel { animation: none; }
        }
      `}</style>
    </span>
  );
}
