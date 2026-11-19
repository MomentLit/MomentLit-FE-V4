"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  IconCube,
  IconDeviceFloppy,
  IconRotate,
  IconRotateClockwise2,
  IconTrash,
  IconView360,
  IconWalk,
  IconLayoutBoard,
  IconX,
} from "@tabler/icons-react";
import { fetchRoom, type Room } from "@/entities/room";
import { cn } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";
import { FURNITURE_CATALOG, findFurniture, normalizeRotation } from "../lib/furniture";
import { polygonArea, toPyeong, wallLengths } from "../lib/geometry";
import type { RoomStageState, RoomView } from "../lib/stage";
import { RoomPlanView } from "./RoomPlanView";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { useFurnitureLayout } from "./useFurnitureLayout";

type ViewerView = RoomView | "plan";

const VIEWS: { id: ViewerView; label: string; icon: typeof IconCube }[] = [
  { id: "photo", label: "사진 시점", icon: IconView360 },
  { id: "miniature", label: "미니어처", icon: IconCube },
  { id: "walk", label: "1인칭", icon: IconWalk },
  { id: "plan", label: "도면", icon: IconLayoutBoard },
];

const VIEW_GUIDE: Record<ViewerView, string> = {
  photo: "드래그로 둘러보고 휠로 확대해요.",
  miniature: "드래그로 돌려 보고 휠로 확대해요. 가구를 골라 바닥을 누르면 놓여요.",
  walk: "드래그로 둘러보기 · WASD/방향키로 걷기(Shift 빠르게) · 바닥을 누르면 그곳으로 걸어가요.",
  plan: "위에서 본 도면이에요. 여기서도 가구를 놓고 끌 수 있어요.",
};

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

/** 공간 상세에서 여는 3D 방 — 사진 시점·미니어처·1인칭·도면으로 보고, 실제 크기 가구를 놓아 본다. */
export function RoomViewerModal({ spaceId, title, onClose }: { spaceId: number; title: string; onClose: () => void }) {
  const roomQuery = useQuery({ queryKey: ["space-room", spaceId], queryFn: () => fetchRoom(spaceId) });
  const room = roomQuery.data;

  return (
    <Modal
      label={`${title} 3D 방`}
      onClose={onClose}
      panelClassName="flex w-full max-w-[1200px] flex-col gap-4 overflow-y-auto border border-line bg-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">3D Room</span>
          <h2 className="truncate section-title text-ink">{title} 3D로 보기</h2>
        </div>
        <button type="button" onClick={onClose} className="button button--outline shrink-0">
          <IconX size={18} stroke={2} aria-hidden />
          닫기
        </button>
      </div>
      {roomQuery.isPending && <p className="p-10 text-center text-sm text-soft">3D 방을 불러오는 중…</p>}
      {roomQuery.isError && <p className="p-10 text-center text-sm text-soft">3D 방을 불러오지 못했어요.</p>}
      {roomQuery.isSuccess && !room && <p className="p-10 text-center text-sm text-soft">이 공간에는 아직 3D 방이 없어요.</p>}
      {room && room.image_url && room.camera_height != null && <RoomViewerBody spaceId={spaceId} room={room} />}
    </Modal>
  );
}

function RoomViewerBody({ spaceId, room }: { spaceId: number; room: Room }) {
  const [view, setView] = useState<ViewerView>("miniature");
  const [selected, setSelected] = useState<number | null>(null);
  const [placingType, setPlacingType] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const layout = useFurnitureLayout(spaceId);
  const { items, setItems } = layout;

  const stageState = useMemo<RoomStageState>(() => ({
    outer: room.geometry.outer,
    corners: [],
    inner: room.geometry.inner,
    cameraHeight: room.camera_height ?? 1.5,
    ceilingHeight: room.ceiling_height,
  }), [room]);

  const area = polygonArea(room.geometry.outer);
  const lengths = wallLengths(room.geometry.outer);
  const selectedItem = selected !== null ? items[selected] : undefined;
  const selectedDef = selectedItem ? findFurniture(selectedItem.type) : undefined;

  const rotateSelected = useCallback((angle: number) => {
    if (selected === null) return;
    setItems((current) => current.map((item, index) =>
      index === selected ? { ...item, rotation: normalizeRotation(item.rotation + angle) } : item));
  }, [selected, setItems]);

  const deleteSelected = useCallback(() => {
    if (selected === null) return;
    setItems((current) => current.filter((_, index) => index !== selected));
    setSelected(null);
  }, [selected, setItems]);

  // 단축키 — R 90°, Shift+R 15°, Delete 지우기, Esc 선택·놓기 취소. (1인칭 이동 키는 무대가 받는다)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || view === "walk") return;
      if (event.key === "r" || event.key === "R") {
        rotateSelected(event.shiftKey ? Math.PI / 12 : Math.PI / 2);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selected !== null) {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape" && (selected !== null || placingType)) {
        // 모달이 Esc로 닫히기 전에 선택부터 푼다
        event.stopPropagation();
        setSelected(null);
        setPlacingType(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [view, selected, placingType, rotateSelected, deleteSelected]);

  function changeView(next: ViewerView) {
    setView(next);
    setHint(null);
    if (next === "walk") {
      setPlacingType(null);
      setSelected(null);
    }
  }

  function startPlacing(type: string) {
    setSelected(null);
    setPlacingType((current) => (current === type ? null : type));
    if (view === "walk" || view === "photo") setView("miniature");
    setHint(null);
  }

  const handlePlace = useCallback((x: number, z: number) => {
    if (!placingType) return;
    const index = items.length;
    setItems((current) => [...current, { type: placingType, x, z, rotation: 0 }]);
    setSelected(index);
    setPlacingType(null);
    setHint("끌어서 옮기고, R 키로 돌리고, Delete 키로 지울 수 있어요.");
  }, [items.length, placingType, setItems]);

  const handleMove = useCallback((index: number, x: number, z: number) => {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, x, z } : item)));
  }, [setItems]);

  const stageView: RoomView = view === "plan" ? "miniature" : view;
  const message = placingType
    ? `바닥을 눌러 ${findFurniture(placingType)?.name ?? "가구"}을(를) 놓으세요.`
    : hint ?? VIEW_GUIDE[view];

  return (
    <>
      <div className="relative">
        <RoomStageCanvas
          imageUrl={room.image_url!}
          state={stageState}
          view={stageView}
          furnitureEditable={view === "miniature" || view === "photo"}
          placingType={placingType}
          furniture={items}
          selectedFurniture={selected}
          onFurnitureSelect={setSelected}
          onFurnitureMove={handleMove}
          onPlace={handlePlace}
          onHint={setHint}
          className="h-[400px] sm:h-[560px]"
        />
        {view === "plan" && (
          <RoomPlanView
            outer={room.geometry.outer}
            inner={room.geometry.inner}
            ceilingHeight={room.ceiling_height}
            furniture={items}
            selected={selected}
            placingType={placingType}
            onSelect={setSelected}
            onMove={handleMove}
            onDragEnd={() => undefined}
            onPlace={handlePlace}
            onHint={setHint}
            className="absolute inset-0 h-full w-full"
          />
        )}
        <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-1" role="group" aria-label="시점">
          {VIEWS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => changeView(id)}
              aria-pressed={view === id}
              className={cn("button min-h-9 px-3 py-1.5", view === id ? "button--primary" : "button--outline")}
            >
              <Icon size={16} stroke={2} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-soft" aria-live="polite">{message}</p>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="toolbar" aria-label="가구 목록">
            {FURNITURE_CATALOG.map((def) => (
              <button
                key={def.id}
                type="button"
                disabled={view === "walk"}
                onClick={() => startPlacing(def.id)}
                aria-pressed={placingType === def.id}
                className={cn("button flex-col gap-0 px-3 py-1.5", placingType === def.id ? "button--primary" : "button--outline")}
              >
                {def.name}
                <small className="font-normal opacity-70">{def.width}×{def.depth}m</small>
              </button>
            ))}
          </div>

          {selectedDef && (
            <div className="flex flex-wrap items-center gap-2 border border-line p-3" role="toolbar" aria-label="선택한 가구">
              <span className="mr-2 text-sm font-semibold text-ink">선택한 가구: {selectedDef.name}</span>
              <button type="button" onClick={() => rotateSelected(Math.PI / 2)} className="button button--outline">
                <IconRotateClockwise2 size={18} stroke={2} aria-hidden />
                90° 돌리기
              </button>
              <button type="button" onClick={() => rotateSelected(Math.PI / 12)} className="button button--outline">
                <IconRotate size={18} stroke={2} aria-hidden />
                15° 돌리기
              </button>
              <button type="button" onClick={deleteSelected} className="button button--danger">
                <IconTrash size={18} stroke={2} aria-hidden />
                지우기
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void layout.save()}
              disabled={!layout.ready || layout.saving || (layout.isAuthenticated && !layout.dirty)}
              className="button button--primary"
            >
              <IconDeviceFloppy size={18} stroke={2} aria-hidden />
              {!layout.isAuthenticated ? "로그인하고 내 배치 저장" : layout.saving ? "저장 중…" : layout.dirty ? "내 배치 저장" : "저장됨"}
            </button>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setItems([]);
                  setSelected(null);
                }}
                className="button button--outline"
              >
                가구 모두 빼기
              </button>
            )}
            <span className="text-xs text-soft">
              {layout.error ?? (layout.isAuthenticated
                ? "저장하면 다음에 열 때 그대로 이어서 볼 수 있어요."
                : "로그인하지 않으면 이 브라우저에만 임시로 남아요.")}
            </span>
          </div>
        </div>

        <div className="border border-line p-4">
          <p className="text-2xl font-bold text-ink">
            {area.toFixed(1)}㎡ <span className="text-base font-semibold text-soft">약 {toPyeong(area).toFixed(1)}평</span>
          </p>
          <p className="text-sm text-soft">천장 {room.ceiling_height.toFixed(2)}m</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-ink">
            {lengths.map((length, index) => (
              <li key={index} className="flex justify-between">
                <span className="text-soft">벽 {index + 1}–{(index + 1) % lengths.length + 1}</span>
                {length.toFixed(2)}m
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

