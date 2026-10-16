"use client";

import { useEffect, useRef } from "react";
import { IconPhotoPlus, IconX } from "@tabler/icons-react";

/** 업로더 한 칸. 이미 올라간 사진은 `url`만, 새로 고른 사진은 `file` + 미리보기용 blob `url`을 가진다. */
export interface PhotoItem {
  id: string;
  url: string;
  file?: File;
}

/** 서버에 이미 있는 사진 URL들을 업로더 항목으로 바꾼다 (수정 폼 프리필용). */
export function toPhotoItems(urls: string[]): PhotoItem[] {
  return urls.map((url) => ({ id: url, url }));
}

/** 새로 고른 파일만 업로드하고, 기존 사진은 URL을 그대로 써서 순서대로 최종 URL 목록을 만든다. */
export async function resolvePhotoUrls(
  items: PhotoItem[],
  upload: (file: File) => Promise<string>,
): Promise<string[]> {
  return Promise.all(items.map((item) => (item.file ? upload(item.file) : Promise.resolve(item.url))));
}

function revokeIfBlob(item: PhotoItem) {
  if (item.file && item.url.startsWith("blob:")) URL.revokeObjectURL(item.url);
}

/**
 * 사진 목록을 가진 폼이 사라질 때 남은 미리보기 blob URL을 해제한다.
 * 업로더가 아니라 목록 주인(폼)이 불러야 한다 — 등록 마법사는 단계를 옮기면 업로더만 언마운트되는데,
 * 그때 해제하면 1단계로 돌아왔을 때 미리보기가 깨진다.
 */
export function useRevokePhotoItemsOnUnmount(items: PhotoItem[]) {
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => () => itemsRef.current.forEach(revokeIfBlob), []);
}

export interface MultiPhotoUploadProps {
  items: PhotoItem[];
  onChange: (items: PhotoItem[]) => void;
  /** 최대 장수. 넘치게 고르면 앞에서부터 남은 칸만큼만 받고 `onOverflow`를 부른다. */
  max: number;
  onOverflow?: () => void;
  disabled?: boolean;
  label?: string;
}

/**
 * 여러 장 사진 업로더 — 첫 번째 사진이 대표 사진이다.
 * 실제 업로드는 제출 시점에 `resolvePhotoUrls`로 한 번에 한다 (고르기만 하고 취소하면 S3에 쓰레기가 안 남게).
 * 삭제한 사진의 미리보기 URL은 여기서 해제하고, 남은 것은 폼이 `useRevokePhotoItemsOnUnmount`로 해제한다.
 */
export function MultiPhotoUpload({ items, onChange, max, onOverflow, disabled = false, label = "공간 사진" }: MultiPhotoUploadProps) {
  function handleSelect(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;

    const accepted = files.slice(0, Math.max(max - items.length, 0));
    if (accepted.length) {
      onChange([
        ...items,
        ...accepted.map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), file })),
      ]);
    }
    // onChange 뒤에 불러야 부모가 onChange에서 경고를 지워도 이 경고가 남는다.
    if (accepted.length < files.length) onOverflow?.();
  }

  function handleRemove(index: number) {
    revokeIfBlob(items[index]);
    onChange(items.filter((_, i) => i !== index));
  }

  function handleMakePrimary(index: number) {
    onChange([items[index], ...items.filter((_, i) => i !== index)]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((item, index) => (
          <div key={item.id} className="relative aspect-[4/3] overflow-hidden bg-wash">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob 미리보기/외부 S3 URL */}
            <img src={item.url} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              disabled={disabled}
              aria-label={`${label} ${index + 1} 삭제`}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center bg-ink/75 text-white hover:bg-ink"
            >
              <IconX size={14} stroke={2.5} aria-hidden />
            </button>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-ink/65 px-2.5 py-1.5 text-xs text-white">
              {index === 0 ? (
                <span className="font-bold">대표 사진</span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleMakePrimary(index)}
                  disabled={disabled}
                  className="font-bold underline-offset-2 hover:underline"
                >
                  대표로 지정
                </button>
              )}
              <span className="font-mono opacity-80">{index + 1}</span>
            </div>
          </div>
        ))}

        {items.length < max && (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1.5 border-2 border-dashed border-line-2 bg-wash text-center text-soft transition-colors hover:border-ink focus-within:border-ink focus-within:outline-2 focus-within:outline-main-d">
            <IconPhotoPlus size={26} stroke={1.5} aria-hidden />
            <span className="text-sm font-bold text-ink">{items.length ? "사진 추가" : "사진 선택하기"}</span>
            <span className="text-xs">여러 장 선택 가능</span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              aria-label={label}
              disabled={disabled}
              onChange={(event) => {
                handleSelect(event.target.files);
                event.target.value = "";
              }}
              className="sr-only"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-soft">
        JPG · PNG · WEBP · 최대 {max}장 ({items.length}/{max}) — 첫 번째 사진이 목록과 상세의 대표 사진이 돼요.
      </p>
    </div>
  );
}
