"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconFlipVertical,
  IconStackBack,
  IconStackFront,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import { loadImageAspect } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";
import {
  FURNITURE_UPLOAD_TYPES,
  INITIAL_FURNITURE_HISTORY,
  createFurnitureItem,
  flipFurniture,
  furnitureHistoryReducer,
  reorderFurniture,
} from "../model";
import { FurnitureCanvas } from "./FurnitureCanvas";
import { FurniturePalette } from "./FurniturePalette";

const LOAD_ERROR_MESSAGE = "가구 사진을 불러오지 못했어요.";

/**
 * 공간 상세 페이지 "원본 보기"에서 여는 가구 배치 미리보기.
 * 배치 결과와 사용자가 올린 가구 사진은 저장하지 않는다 — 닫으면 사라진다.
 */
export function FurniturePlacementModal({ photoSrc, title, onClose }: {
  /** `#crop=` 없는 원본 사진 주소. */
  photoSrc: string;
  title: string;
  onClose: () => void;
}) {
  const [history, dispatch] = useReducer(furnitureHistoryReducer, INITIAL_FURNITURE_HISTORY);
  const items = history.present;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // 실행 취소로 되살릴 수 있어서, 올린 사진의 미리보기 URL은 가구를 빼도 바로 해제하지 않고 닫을 때 한꺼번에 해제한다.
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    return () => objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // 실행 취소로 선택한 가구가 사라지면 선택도 풀린 것으로 본다(`selected`가 null).
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedIndex = selected ? items.indexOf(selected) : -1;

  async function addFurniture(name: string, src: string) {
    setError(null);
    setAdding(true);
    try {
      const item = createFurnitureItem({ name, src, aspect: await loadImageAspect(src) });
      dispatch({ type: "add", item });
      setSelectedId(item.id);
      return true;
    } catch {
      setError(LOAD_ERROR_MESSAGE);
      return false;
    } finally {
      setAdding(false);
    }
  }

  async function handleUpload(file: File) {
    if (!(FURNITURE_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
      setError("JPG · PNG · WEBP 사진만 올릴 수 있어요.");
      return;
    }
    const url = URL.createObjectURL(file);
    const added = await addFurniture(file.name.replace(/\.[^.]+$/, "") || "내 가구", url);
    if (added) objectUrlsRef.current.push(url);
    else URL.revokeObjectURL(url);
  }

  function handleRemove(id: string) {
    dispatch({ type: "apply", items: items.filter((item) => item.id !== id) });
    setSelectedId(null);
  }

  return (
    <Modal label={`${title} 가구 배치`} onClose={onClose} panelClassName="flex w-full max-w-[1100px] flex-col gap-4 overflow-y-auto border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">Furniture</span>
          <h2 className="truncate section-title text-ink">가구 배치해 보기</h2>
        </div>
        <button type="button" onClick={onClose} className="button button--outline shrink-0">
          <IconX size={18} stroke={2} aria-hidden />
          닫기
        </button>
      </div>

      <div className="bg-ink py-10">
        <FurnitureCanvas
          photoSrc={photoSrc}
          items={items}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onApply={(next) => dispatch({ type: "apply", items: next })}
          onPreview={(next) => dispatch({ type: "preview", items: next })}
          onCommit={(before) => dispatch({ type: "commit", before })}
          onRemove={handleRemove}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="가구 편집">
        <button type="button" onClick={() => dispatch({ type: "undo" })} disabled={history.past.length === 0} className="button button--outline">
          <IconArrowBackUp size={18} stroke={2} aria-hidden />
          실행 취소
        </button>
        <button type="button" onClick={() => dispatch({ type: "redo" })} disabled={history.future.length === 0} className="button button--outline">
          <IconArrowForwardUp size={18} stroke={2} aria-hidden />
          다시 실행
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && dispatch({ type: "apply", items: items.map((item) => (item.id === selected.id ? flipFurniture(item) : item)) })}
          className="button button--outline"
        >
          <IconFlipVertical size={18} stroke={2} aria-hidden />
          좌우 반전
        </button>
        <button
          type="button"
          disabled={!selected || selectedIndex === items.length - 1}
          onClick={() => selected && dispatch({ type: "apply", items: reorderFurniture(items, selected.id, 1) })}
          className="button button--outline"
        >
          <IconStackFront size={18} stroke={2} aria-hidden />
          앞으로
        </button>
        <button
          type="button"
          disabled={!selected || selectedIndex === 0}
          onClick={() => selected && dispatch({ type: "apply", items: reorderFurniture(items, selected.id, -1) })}
          className="button button--outline"
        >
          <IconStackBack size={18} stroke={2} aria-hidden />
          뒤로
        </button>
        <button type="button" disabled={!selected} onClick={() => selected && handleRemove(selected.id)} className="button button--danger">
          <IconTrash size={18} stroke={2} aria-hidden />
          빼기
        </button>
      </div>

      {error && <p role="alert" className="text-sm font-bold text-ink">{error}</p>}

      <FurniturePalette onUpload={(file) => void handleUpload(file)} disabled={adding} />
    </Modal>
  );
}
