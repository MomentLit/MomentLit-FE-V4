"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { IconChevronDown } from "@tabler/icons-react";

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

export interface DropdownProps<T extends string> {
  value: T | "";
  options: DropdownOption<T>[];
  onChange: (value: T | "") => void;
  placeholder: string;
  ariaLabel: string;
  /** Underline under the trigger + highlight behind the selected option — mirrors the hero's `.ml-pick` marker style. */
  accent?: string;
  className?: string;
}

/** Custom listbox dropdown — swaps in for a native `<select>` where we want the marker-underline trigger and a styled panel to match. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder,
  ariaLabel,
  accent = "var(--sky)",
  className,
}: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

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

  const selected = options.find((option) => option.value === value);

  // The hero's search line is a <p> (phrasing content only), so every element
  // here is a <span>/<button> rather than the usual div/ul/li — those aren't
  // valid inside a <p> and trigger a hydration error. ARIA roles below carry
  // the listbox semantics that ul/li would normally provide.
  return (
    <span
      ref={rootRef}
      className={`relative inline-block ${className ?? ""}`}
      style={{ "--pc": accent } as CSSProperties}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="inline-flex items-center gap-1 px-[3px] py-[1px] pb-[3px] font-bold text-ink shadow-[inset_0_-0.28em_0_var(--pc)] transition-[box-shadow,color] duration-200 hover:shadow-[inset_0_-1.35em_0_var(--pc)]"
      >
        {selected ? selected.label : placeholder}
        <IconChevronDown
          size={16}
          stroke={2.5}
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <span
          role="listbox"
          aria-label={ariaLabel}
          className="dropdown-panel absolute left-0 top-[calc(100%+10px)] z-50 flex max-h-64 min-w-[168px] flex-col overflow-y-auto border border-ink bg-white py-1 shadow-[0_12px_28px_-8px_rgba(21,23,28,0.28)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={value === ""}
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={`w-full px-3.5 py-2 text-left text-sm font-bold transition-colors ${
              value === "" ? "bg-wash text-ink" : "text-soft hover:bg-wash hover:text-ink"
            }`}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={value === option.value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`w-full px-3.5 py-2 text-left text-sm font-bold transition-colors ${
                value === option.value ? "text-ink" : "text-ink hover:bg-wash"
              }`}
              style={value === option.value ? { background: "var(--pc)" } : undefined}
            >
              {option.label}
            </button>
          ))}
        </span>
      )}

      <style>{`
        @keyframes dropdown-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: none; }
        }
        .dropdown-panel { animation: dropdown-in 0.16s cubic-bezier(0.2, 0.85, 0.25, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .dropdown-panel { animation: none; }
        }
      `}</style>
    </span>
  );
}
