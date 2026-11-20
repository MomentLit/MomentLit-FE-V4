"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconCube,
  IconLayoutBoard,
  IconRotate,
  IconRotateClockwise2,
  IconTrash,
  IconView360,
  IconWalk,
} from "@tabler/icons-react";
import { fetchRooms, type Room } from "@/entities/room";
import { fetchSpace } from "@/entities/space/api";
import { cn } from "@/shared/lib";
import { FURNITURE_CATALOG, findFurniture, normalizeRotation } from "../lib/furniture";
import { polygonArea, toPyeong, wallLengths } from "../lib/geometry";
import type { RoomStageState, RoomView } from "../lib/stage";
import { LayoutsPanel } from "./LayoutsPanel";
import { RoomPlanView } from "./RoomPlanView";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { useFurnitureLayouts } from "./useFurnitureLayout";
import { ViewSwitch, type ViewOption } from "./ViewSwitch";

type ViewerView = RoomView | "plan";

const VIEWS: readonly ViewOption<ViewerView>[] = [
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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line p-4 last:border-b-0">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** 이 화면에서 그릴 수 있는 방 — 파노라마 사진과 촬영 높이가 있어야 한다. */
function isViewable(room: Room) {
  return Boolean(room.image_url) && room.camera_height != null;
}

/**
 * `/spaces/{id}/room` — 공간의 3D 방(360° 장면마다 하나)을 화면 가득 보여 주고, 실제 크기 가구를 놓아 보고, 배치를 여러 개 저장한다.
 * 방이 여러 개면 위쪽 탭으로 옮겨 다닌다. 가구 배치는 방마다 따로다.
 */
export function RoomViewer({ spaceId }: { spaceId: number }) {
  const roomsQuery = useQuery({ queryKey: ["space-rooms", spaceId], queryFn: () => fetchRooms(spaceId) });
  const spaceQuery = useQuery({ queryKey: ["space", spaceId], queryFn: () => fetchSpace(spaceId) });
  const rooms = (roomsQuery.data ?? []).filter(isViewable);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const room = rooms.find((item) => item.room_id === selectedRoomId) ?? rooms[0];
  const title = spaceQuery.data?.name ?? "공간";

  const message = roomsQuery.isPending
    ? "3D 방을 불러오는 중…"
    : roomsQuery.isError
      ? "3D 방을 불러오지 못했어요."
      : !room
        ? "이 공간에는 아직 3D 방이 없어요."
        : null;

  return (
    <div className="flex h-dvh min-h-[560px] w-full flex-col bg-white">
      {message || !room ? (
        <>
          <ViewerHeader spaceId={spaceId} title={title} />
          <p className="flex flex-1 items-center justify-center p-10 text-sm text-soft">{message}</p>
        </>
      ) : (
        // 방을 바꾸면 무대·가구 배치를 새로 만든다(방마다 사진·크기·배치가 다르다).
        <RoomViewerBody
          key={room.room_id}
          spaceId={spaceId}
          title={title}
          room={room}
          rooms={rooms}
          onRoomChange={setSelectedRoomId}
        />
      )}
    </div>
  );
}

function ViewerHeader({ spaceId, title, children }: { spaceId: number; title: string; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
      <Link href={`/spaces/${spaceId}`} aria-label="공간으로 돌아가기" className="button button--outline button--sm button--icon">
        <IconArrowLeft size={16} stroke={2} aria-hidden />
      </Link>
      <div className="min-w-0 flex-1">
        <span className="block font-mono text-[0.62rem] font-medium uppercase leading-none tracking-[0.18em] text-soft">3D Room</span>
        <h1 className="truncate text-base font-bold leading-tight text-ink">{title}</h1>
      </div>
      {children}
    </header>
  );
}

function RoomTabs({ rooms, activeId, onChange }: { rooms: readonly Room[]; activeId: number; onChange: (roomId: number) => void }) {
  if (rooms.length < 2) return null;
  return (
    <nav className="tabs border-b border-line px-3" aria-label="방">
      {rooms.map((item) => (
        <button
          key={item.room_id}
          type="button"
          onClick={() => onChange(item.room_id)}
          aria-current={item.room_id === activeId ? "true" : undefined}
          className="tabs__item"
        >
          {item.name}
        </button>
      ))}
    </nav>
  );
}

function RoomViewerBody({ spaceId, title, room, rooms, onRoomChange }: {
  spaceId: number;
  title: string;
  room: Room;
  rooms: readonly Room[];
  onRoomChange: (roomId: number) => void;
}) {
  const [view, setView] = useState<ViewerView>("miniature");
  const [selected, setSelected] = useState<number | null>(null);
  const [placingType, setPlacingType] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const layouts = useFurnitureLayouts(spaceId, room.room_id);
  const { items, setItems } = layouts;

  const stageState = useMemo<RoomStageState>(() => ({
    outer: room.geometry.outer,
    corners: [],
    inner: room.geometry.inner,
    cameraHeight: room.camera_height ?? 1.5,
    ceilingHeight: room.ceiling_height,
  }), [room]);

  const area = polygonArea(room.geometry.outer);
  const lengths = wallLengths(room.geometry.outer);
  // 저장된 배치를 불러오면 목록이 바뀌어 선택한 번호가 없는 가구를 가리킬 수 있다.
  const selectedItem = selected !== null ? items[selected] : undefined;
  const selectedDef = selectedItem ? findFurniture(selectedItem.type) : undefined;
  const selectedIndex = selectedItem ? selected : null;

  const rotateSelected = useCallback((angle: number) => {
    if (selectedIndex === null) return;
    setItems((current) => current.map((item, index) =>
      index === selectedIndex ? { ...item, rotation: normalizeRotation(item.rotation + angle) } : item));
  }, [selectedIndex, setItems]);

  const deleteSelected = useCallback(() => {
    if (selectedIndex === null) return;
    setItems((current) => current.filter((_, index) => index !== selectedIndex));
    setSelected(null);
  }, [selectedIndex, setItems]);

  // 단축키 — R 90°, Shift+R 15°, Delete 지우기, Esc 선택·놓기 취소. (1인칭 이동 키는 무대가 받는다)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || view === "walk") return;
      if (event.key === "r" || event.key === "R") {
        rotateSelected(event.shiftKey ? Math.PI / 12 : Math.PI / 2);
      } else if ((event.key === "Delete" || event.key === "Backspace") && selectedIndex !== null) {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        setSelected(null);
        setPlacingType(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, selectedIndex, rotateSelected, deleteSelected]);

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
      <ViewerHeader spaceId={spaceId} title={title}>
        <ViewSwitch options={VIEWS} value={view} onChange={changeView} />
      </ViewerHeader>
      <RoomTabs rooms={rooms} activeId={room.room_id} onChange={onRoomChange} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[58dvh] shrink-0 lg:h-auto lg:flex-1">
          <RoomStageCanvas
            imageUrl={room.image_url!}
            state={stageState}
            view={stageView}
            furnitureEditable={view === "miniature" || view === "photo"}
            placingType={placingType}
            furniture={items}
            selectedFurniture={selectedIndex}
            onFurnitureSelect={setSelected}
            onFurnitureMove={handleMove}
            onPlace={handlePlace}
            onHint={setHint}
            className="h-full w-full"
          />
          {view === "plan" && (
            <RoomPlanView
              outer={room.geometry.outer}
              inner={room.geometry.inner}
              ceilingHeight={room.ceiling_height}
              furniture={items}
              selected={selectedIndex}
              placingType={placingType}
              onSelect={setSelected}
              onMove={handleMove}
              onDragEnd={() => undefined}
              onPlace={handlePlace}
              onHint={setHint}
              className="absolute inset-0 h-full w-full"
            />
          )}
          {/* 선택한 가구 — 화면 위에 띄워서, 고르고 풀 때 옆 패널이 밀리지 않게 */}
          {selectedDef && (
            <div
              role="toolbar"
              aria-label="선택한 가구"
              className="absolute left-3 top-3 flex items-center gap-1 border border-line bg-white p-1 pl-3 shadow-[0_2px_10px_rgba(21,23,28,.18)]"
            >
              <span className="mr-1 text-sm font-semibold text-ink">{selectedDef.name}</span>
              <button type="button" onClick={() => rotateSelected(Math.PI / 2)} className="button button--outline button--sm" title="90° 돌리기 (R)">
                <IconRotateClockwise2 size={15} stroke={2} aria-hidden />
                90°
              </button>
              <button type="button" onClick={() => rotateSelected(Math.PI / 12)} className="button button--outline button--sm" title="15° 돌리기 (Shift+R)">
                <IconRotate size={15} stroke={2} aria-hidden />
                15°
              </button>
              <button type="button" onClick={deleteSelected} aria-label="지우기 (Delete)" title="지우기 (Delete)" className="button button--danger button--sm button--icon">
                <IconTrash size={15} stroke={2} aria-hidden />
              </button>
            </div>
          )}
          <p
            aria-live="polite"
            className="pointer-events-none absolute bottom-3 left-3 right-3 bg-black/65 px-3 py-2 text-[0.8125rem] text-white sm:right-auto sm:max-w-[520px]"
          >
            {message}
          </p>
        </div>

        <aside className="flex flex-col overflow-y-auto border-line lg:w-[360px] lg:shrink-0 lg:border-l">
          <Section title="가구 놓기">
            <div className="grid grid-cols-2 gap-2" role="toolbar" aria-label="가구 목록">
              {FURNITURE_CATALOG.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  disabled={view === "walk"}
                  onClick={() => startPlacing(def.id)}
                  aria-pressed={placingType === def.id}
                  className={cn("button button--sm h-14 flex-col gap-0", placingType === def.id ? "button--primary" : "button--outline")}
                >
                  {def.name}
                  <small className="text-[0.7rem] font-normal opacity-70">{def.width}×{def.depth}m</small>
                </button>
              ))}
            </div>
            <p className="text-xs text-soft">
              {view === "walk" ? "1인칭에서는 둘러보기만 해요. 가구는 다른 시점에서 놓아 주세요." : "고른 가구는 R로 돌리고 Delete로 지워요."}
            </p>
          </Section>

          <Section title="내 배치">
            <LayoutsPanel layouts={layouts} />
          </Section>

          <Section title={rooms.length > 1 ? `방 정보 — ${room.name}` : "방 정보"}>
            <p className="text-2xl font-bold text-ink">
              {area.toFixed(1)}㎡ <span className="text-base font-semibold text-soft">약 {toPyeong(area).toFixed(1)}평</span>
            </p>
            <p className="text-sm text-soft">천장 {room.ceiling_height.toFixed(2)}m</p>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-ink">
              {lengths.map((length, index) => (
                <li key={index} className="flex justify-between">
                  <span className="text-soft">벽 {index + 1}–{(index + 1) % lengths.length + 1}</span>
                  {length.toFixed(2)}m
                </li>
              ))}
            </ul>
          </Section>
        </aside>
      </div>
    </>
  );
}
