"use client";

import { Search, X } from "lucide-react";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** 이름 키워드 검색 — 공간 모드는 백엔드 `SpaceSearchParams.name`에 대응, 팝업 모드는 클라이언트 필터링(POPUP_SEARCH_FETCH_SIZE 참고). 입력은 부모에서 디바운스된다. */
export function SearchBar({ value, onChange, placeholder = "공간 이름으로 검색" }: SearchBarProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-line px-6 py-4">
      <Search size={18} strokeWidth={2} className="flex-none text-soft" aria-hidden />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-soft"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="검색어 지우기"
          className="flex-none text-soft transition-colors hover:text-ink"
        >
          <X size={16} strokeWidth={2} aria-hidden />
        </button>
      )}
    </div>
  );
}
