"use client";

import { cn } from "@/shared/lib";

interface PaginationProps {
  /** 0-indexed, matching the backend's `Page.getNumber()`. */
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const WINDOW_SIZE = 5;

/** Numbered pagination + "다음" — no "이전" arrow, per design-reference.html `.pager`. */
export function Pagination({ page, totalPages, onPageChange, disabled }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = Math.max(0, Math.min(page - Math.floor(WINDOW_SIZE / 2), totalPages - WINDOW_SIZE));
  const pages = Array.from({ length: Math.min(WINDOW_SIZE, totalPages) }, (_, i) => start + i);

  return (
    <div className="flex justify-center gap-0.5 py-6" aria-label="페이지네이션">
      {pages.map((n) => (
        <button
          key={n}
          type="button"
          aria-current={page === n ? "page" : undefined}
          disabled={disabled}
          onClick={() => onPageChange(n)}
          className={cn(
            "grid h-[34px] w-[34px] place-items-center rounded-md font-mono text-[0.78rem] disabled:cursor-not-allowed disabled:opacity-60",
            page === n ? "bg-primary-100 text-ink" : "border border-line text-ink hover:border-line-2",
          )}
        >
          {n + 1}
        </button>
      ))}
      <button
        type="button"
        aria-label="다음 페이지"
        disabled={disabled || page >= totalPages - 1}
        onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
        className="grid h-[34px] w-[34px] place-items-center rounded-md border border-line text-ink hover:border-line-2 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ›
      </button>
    </div>
  );
}
