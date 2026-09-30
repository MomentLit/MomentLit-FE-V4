"use client";

import { IconPhotoPlus } from "@tabler/icons-react";

export function PhotoUpload({ file, onChange, label = "대표 사진", required = false }: { file: File | null; onChange: (file: File | null) => void; label?: string; required?: boolean }) {
  return (
    <label className="flex cursor-pointer flex-col items-center gap-3 border-2 border-dashed border-line-2 bg-wash p-6 text-center transition-colors hover:border-ink focus-within:border-ink focus-within:outline-2 focus-within:outline-main-d">
      <IconPhotoPlus size={32} stroke={1.5} aria-hidden />
      <span className="button button--primary">{file ? "사진 변경하기" : "사진 선택하기"}</span>
      <span className="text-sm text-soft">{file ? file.name : "버튼을 눌러 공간의 첫인상을 담아주세요"}</span>
      <span className="text-xs text-soft">JPG · PNG · WEBP</span>
      <input required={required} type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} onChange={(event) => onChange(event.target.files?.[0] ?? null)} className="sr-only" />
    </label>
  );
}
