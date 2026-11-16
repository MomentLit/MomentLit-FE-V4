"use client";

import { IconPhotoPlus } from "@tabler/icons-react";

import { FURNITURE_UPLOAD_TYPES } from "../model";

/** 내 가구 사진 올리기. 올린 사진은 서버에 보내지 않는다. */
export function FurniturePalette({
  onUpload,
  disabled = false,
}: {
  onUpload: (file: File) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-line-2 bg-wash p-4 text-sm font-bold text-ink transition-colors hover:border-ink focus-within:border-ink focus-within:outline-2 focus-within:outline-main-d">
        <IconPhotoPlus size={22} stroke={1.5} aria-hidden />
        내 가구 사진 올리기
        <span className="text-xs font-normal text-soft">JPG · PNG · WEBP</span>
        <input
          type="file"
          accept={FURNITURE_UPLOAD_TYPES.join(",")}
          aria-label="내 가구 사진 올리기"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // 같은 파일을 다시 골라도 onChange가 오도록 비운다.
            event.target.value = "";
            if (file) onUpload(file);
          }}
          className="sr-only"
        />
      </label>
      <p className="text-xs text-soft">
        내 가구 사진은 이 화면에서만 쓰고 저장하지 않아요. 배경이 그대로 보이니, 배경 제거 앱이나 사이트에서 배경을 지운 투명 PNG로 만들어 올리면 더 자연스러워요.
      </p>
    </div>
  );
}
