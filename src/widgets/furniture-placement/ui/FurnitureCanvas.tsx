"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { IconArrowsDiagonal, IconRotateClockwise } from "@tabler/icons-react";

import { cn } from "@/shared/lib";
import {
  KEYBOARD_MOVE_STEP,
  moveFurniture,
  resizeFurniture,
  rotateFurniture,
  type FurnitureItem,
} from "../model";

type GestureKind = "move" | "resize" | "rotate";

interface Gesture {
  kind: GestureKind;
  pointerId: number;
  /** 누르기 시작한 시점의 전체 목록 — 손을 떼면 실행 취소 기록에 들어간다. */
  before: FurnitureItem[];
  item: FurnitureItem;
  startX: number;
  startY: number;
  /** 크기 조절 시작 시 가구 가운데부터 손가락까지의 거리(px). */
  startDistance: number;
  /** 회전 시작 시 가구 가운데에서 손가락 방향(도). */
  startAngle: number;
}

/**
 * 공간 사진 위에 가구를 겹쳐 그리고 끌어서 옮기기·크기 조절·회전을 처리한다.
 * 가구를 누르면 선택되고, 모서리 손잡이로 크기를, 위쪽 손잡이로 회전을 바꾼다.
 * 선택한 가구는 방향키로 옮기고 Delete/Backspace로 뺄 수 있다.
 */
export function FurnitureCanvas({
  photoSrc,
  items,
  selectedId,
  onSelect,
  onApply,
  onPreview,
  onCommit,
  onRemove,
}: {
  photoSrc: string;
  items: FurnitureItem[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 바로 기록에 남기는 변경(방향키 이동 등). */
  onApply: (items: FurnitureItem[]) => void;
  /** 끌기 중 화면만 바꾸는 변경. */
  onPreview: (items: FurnitureItem[]) => void;
  /** 끌기를 마쳤을 때 시작 시점 목록을 넘긴다. */
  onCommit: (before: FurnitureItem[]) => void;
  onRemove: (id: string) => void;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  function itemCenter(item: FurnitureItem, rect: DOMRect) {
    return { x: rect.left + item.x * rect.width, y: rect.top + item.y * rect.height };
  }

  function startGesture(event: PointerEvent<HTMLElement>, item: FurnitureItem, kind: GestureKind) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect || event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    // preventDefault로 브라우저가 포커스를 옮기지 않을 수 있어서, 누른 가구에 직접 포커스를 준다 — 바로 방향키·Delete가 먹게.
    // 손잡이를 눌렀으면 손잡이가 아니라 그 가구에 준다.
    (event.currentTarget.closest<HTMLElement>("[data-furniture-item]") ?? event.currentTarget).focus({ preventScroll: true });
    onSelect(item.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    const center = itemCenter(item, rect);
    gestureRef.current = {
      kind,
      pointerId: event.pointerId,
      before: items,
      item,
      startX: event.clientX,
      startY: event.clientY,
      startDistance: Math.max(1, Math.hypot(event.clientX - center.x, event.clientY - center.y)),
      startAngle: (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!gesture || !rect || gesture.pointerId !== event.pointerId) return;
    const { item } = gesture;
    let next: FurnitureItem;
    if (gesture.kind === "move") {
      next = moveFurniture(
        item,
        item.x + (event.clientX - gesture.startX) / rect.width,
        item.y + (event.clientY - gesture.startY) / rect.height,
      );
    } else {
      const center = itemCenter(item, rect);
      if (gesture.kind === "resize") {
        const distance = Math.hypot(event.clientX - center.x, event.clientY - center.y);
        next = resizeFurniture(item, item.width * (distance / gesture.startDistance));
      } else {
        const angle = (Math.atan2(event.clientY - center.y, event.clientX - center.x) * 180) / Math.PI;
        next = rotateFurniture(item, item.rotation + angle - gesture.startAngle);
      }
    }
    onPreview(gesture.before.map((current) => (current.id === item.id ? next : current)));
  }

  function endGesture(event: PointerEvent<HTMLDivElement>) {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gestureRef.current = null;
    onCommit(gesture.before);
  }

  function handleItemKeyDown(event: KeyboardEvent<HTMLDivElement>, item: FurnitureItem) {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEYBOARD_MOVE_STEP, 0],
      ArrowRight: [KEYBOARD_MOVE_STEP, 0],
      ArrowUp: [0, -KEYBOARD_MOVE_STEP],
      ArrowDown: [0, KEYBOARD_MOVE_STEP],
    };
    const delta = moves[event.key];
    if (delta) {
      event.preventDefault();
      const next = moveFurniture(item, item.x + delta[0], item.y + delta[1]);
      onApply(items.map((current) => (current.id === item.id ? next : current)));
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      onRemove(item.id);
    }
  }

  if (photoFailed) {
    return (
      <p role="alert" className="flex h-[min(60dvh,480px)] w-full items-center justify-center bg-ink px-4 text-center text-sm text-white">
        사진을 불러오지 못했어요.
      </p>
    );
  }

  return (
    <div className="relative mx-auto w-fit max-w-full select-none">
      {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
      <img
        src={photoSrc}
        alt="가구를 배치할 공간 사진"
        draggable={false}
        onError={() => setPhotoFailed(true)}
        className="block max-h-[min(65dvh,720px)] max-w-full"
      />
      <div
        ref={overlayRef}
        // 넘치는 부분을 자르지 않는다 — 가구가 사진 밖 여백까지 걸쳐 보여도 되고, 가장자리 가구의 손잡이도 잘리지 않는다.
        className="absolute inset-0 touch-none"
        onPointerDown={(event) => {
          // 빈 곳을 누르면 선택을 푼다.
          if (event.target === event.currentTarget) onSelect(null);
        }}
        onPointerMove={handlePointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
      >
        {items.map((item) => {
          const selected = item.id === selectedId;
          return (
            <div
              key={item.id}
              data-furniture-item
              role="button"
              tabIndex={0}
              aria-label={`${item.name} — 방향키로 옮기고 Delete로 빼요`}
              aria-pressed={selected}
              onPointerDown={(event) => startGesture(event, item, "move")}
              onFocus={() => onSelect(item.id)}
              onKeyDown={(event) => handleItemKeyDown(event, item)}
              className={cn(
                "absolute cursor-move outline-none",
                selected && "outline-2 outline-offset-2 outline-dashed outline-white",
              )}
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.width * 100}%`,
                aspectRatio: `${item.aspect}`,
                transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 기본 가구 SVG 또는 사용자가 고른 사진의 미리보기 URL */}
              <img
                src={item.src}
                alt=""
                draggable={false}
                className="pointer-events-none h-full w-full object-contain"
                style={{ transform: item.flipped ? "scaleX(-1)" : undefined }}
              />
              {selected && (
                <>
                  <span
                    role="presentation"
                    title="돌려서 회전"
                    onPointerDown={(event) => startGesture(event, item, "rotate")}
                    className="absolute -top-10 left-1/2 flex h-7 w-7 -translate-x-1/2 cursor-grab items-center justify-center rounded-full border border-ink bg-white text-ink shadow"
                  >
                    <IconRotateClockwise size={16} stroke={2.5} aria-hidden />
                  </span>
                  <span
                    role="presentation"
                    title="끌어서 크기 조절"
                    onPointerDown={(event) => startGesture(event, item, "resize")}
                    className="absolute -bottom-3.5 -right-3.5 flex h-7 w-7 cursor-nwse-resize items-center justify-center rounded-full border border-ink bg-white text-ink shadow"
                  >
                    <IconArrowsDiagonal size={14} stroke={2.5} aria-hidden />
                  </span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
