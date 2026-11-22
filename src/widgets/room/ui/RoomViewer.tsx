"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  IconArrowLeft,
  IconCube,
  IconLayoutBoard,
  IconLoader2,
  IconRotate,
  IconRotateClockwise2,
  IconTrash,
  IconView360,
  IconWalk,
} from "@tabler/icons-react";
import { fetchRooms, type Room } from "@/entities/room";
import { fetchSpace } from "@/entities/space/api";
import { cn } from "@/shared/lib";
import { findFurniture, furnitureMount, isStackable, normalizeRotation } from "../lib/furniture";
import { ceilingMountY, DEFAULT_WALL_CENTER, itemsOnTop, nearestWallPlacement, wallMountY } from "../lib/placement";
import { polygonArea, toPyeong, wallLengths } from "../lib/geometry";
import type { FurnitureMove, FurniturePlacement, RoomStageState, RoomView } from "../lib/stage";
import { roomPlanFloorImage } from "../planModel";
import { PanelSection as Section, PanelToggleButton } from "./EditorChrome";
import { FurniturePicker } from "./FurniturePicker";
import { LayoutsPanel } from "./LayoutsPanel";
import { RoomPlanView } from "./RoomPlanView";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { useFurnitureLayouts } from "./useFurnitureLayout";
import { useFurnitureLibrary } from "./useFurnitureLibrary";
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

/** 가구 놓기 안내 — 어디를 누르면 되는지 놓는 방식마다 다르다. */
function placingMessage(type: string) {
  const def = findFurniture(type);
  const name = def?.name ?? "가구";
  switch (furnitureMount(def)) {
    case "wall":
      return `벽을 눌러 ${name}을(를) 거세요. 누른 높이에 걸려요.`;
    case "ceiling":
      return `${name}을(를) 달 자리를 누르세요. 천장에 매달려요.`;
    default:
      return isStackable(def)
        ? `바닥이나 가구 윗면을 눌러 ${name}을(를) 놓으세요.`
        : `바닥을 눌러 ${name}을(를) 놓으세요.`;
  }
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

/** 이 화면에서 그릴 수 있는 방 — 파노라마 방은 사진과 촬영 높이, 도면 방은 도면 정보가 있어야 한다. */
function isViewable(room: Room) {
  if (room.source === "PLAN") return roomPlanFloorImage(room) !== null;
  return Boolean(room.image_url) && room.camera_height != null;
}

/**
 * `/spaces/{id}/room` — 공간의 3D 방(360° 장면마다 하나, 도면으로 만든 방)을 화면 가득 보여 주고, 실제 크기 가구를 놓아 보고, 배치를 여러 개 저장한다.
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
      <div className="min-w-[120px] flex-1">
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
  // 오른쪽 정보 칸 — 접으면 3D 화면을 넓게 쓴다
  const [panelOpen, setPanelOpen] = useState(true);
  const library = useFurnitureLibrary();
  // 받고 있는 가구 모델 수 — 무대가 알려 준다
  const [loadingModels, setLoadingModels] = useState(0);
  // 도면으로 만든 방은 사진이 없어 사진 시점이 없고, 벽은 무늬 없는 색·바닥엔 도면(호스트가 켰으면)을 깐다
  const isPlan = room.source === "PLAN";
  const floorImage = isPlan && room.geometry.plan?.show_floor ? roomPlanFloorImage(room) : null;
  const views = isPlan ? VIEWS.filter((option) => option.id !== "photo") : VIEWS;

  const stageState = useMemo<RoomStageState>(() => ({
    ...(room.source === "PLAN"
      ? {
        surface: { kind: "plan" as const, floor: room.geometry.plan?.show_floor ? roomPlanFloorImage(room) : null },
        walkStart: null,
      }
      : {}),
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

  // 벽에 건 가구는 늘 방 안쪽을 본다 — 돌리지 않는다
  const selectedRotatable = furnitureMount(selectedDef) !== "wall";

  const rotateSelected = useCallback((angle: number) => {
    if (selectedIndex === null || !selectedRotatable) return;
    setItems((current) => {
      const base = current[selectedIndex];
      if (!base) return current;
      // 위에 올린 소품도 받침 가운데를 축으로 같이 돈다
      const riders = new Set(itemsOnTop(current, selectedIndex, findFurniture));
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return current.map((item, index) => {
        if (index === selectedIndex) return { ...item, rotation: normalizeRotation(item.rotation + angle) };
        if (!riders.has(index)) return item;
        const dx = item.x - base.x;
        const dz = item.z - base.z;
        // three.js y축 회전과 같은 방향
        return { ...item, x: base.x + dx * cos + dz * sin, z: base.z - dx * sin + dz * cos, rotation: normalizeRotation(item.rotation + angle) };
      });
    });
  }, [selectedIndex, selectedRotatable, setItems]);

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

  const handlePlace = useCallback((placement: FurniturePlacement) => {
    if (!placingType) return;
    const index = items.length;
    const { x, z, y, rotation = 0 } = placement;
    setItems((current) => [...current, { type: placingType, x, z, y, rotation }]);
    setSelected(index);
    setPlacingType(null);
    setHint("끌어서 옮기고, R 키로 돌리고, Delete 키로 지울 수 있어요.");
  }, [items.length, placingType, setItems]);

  // 3D에서 끌기 — 위에 올린 소품, 받침이 사라져 내려앉는 소품까지 한 번에 온다
  const handleStageMove = useCallback((moves: FurnitureMove[]) => {
    setItems((current) => {
      const next = [...current];
      for (const move of moves) {
        const item = next[move.index];
        if (item) next[move.index] = { ...item, x: move.x, z: move.z, y: move.y, rotation: move.rotation ?? item.rotation };
      }
      return next;
    });
  }, [setItems]);

  /** 도면에서 누른 점에 `type` 가구를 놓을 자리 — 벽 가구는 가장 가까운 벽에 붙이고, 천장 가구는 천장에 단다. */
  const planPlacement = useCallback((type: string, x: number, z: number, current?: { y?: number | null }): FurniturePlacement | null => {
    const def = findFurniture(type);
    const height = def?.height ?? 0.5;
    const mount = furnitureMount(def);
    if (mount === "wall") {
      const snap = nearestWallPlacement([x, z], room.geometry.outer, room.geometry.inner, def?.depth ?? 0.1);
      if (!snap) return null;
      return { x: snap.x, z: snap.z, rotation: snap.rotation, y: current?.y ?? wallMountY(DEFAULT_WALL_CENTER, height, room.ceiling_height) };
    }
    if (mount === "ceiling") return { x, z, y: ceilingMountY(height, room.ceiling_height) };
    // 도면에서는 높이를 바꾸지 않는다(가구 위 소품은 받침과 같이 옮기고, 받침을 벗어나면 3D 무대가 내려앉힌다)
    return { x, z, y: current?.y ?? 0 };
  }, [room]);

  const handlePlanPlace = useCallback((x: number, z: number) => {
    if (!placingType) return;
    const placement = planPlacement(placingType, x, z);
    if (placement) handlePlace(placement);
  }, [placingType, planPlacement, handlePlace]);

  const handlePlanMove = useCallback((index: number, x: number, z: number) => {
    setItems((current) => {
      const item = current[index];
      const placement = item && planPlacement(item.type, x, z, item);
      if (!placement) return current;
      const dx = placement.x - item.x;
      const dz = placement.z - item.z;
      const riders = new Set(itemsOnTop(current, index, findFurniture));
      return current.map((other, i) => {
        if (i === index) return { ...other, x: placement.x, z: placement.z, y: placement.y, rotation: placement.rotation ?? other.rotation };
        return riders.has(i) ? { ...other, x: other.x + dx, z: other.z + dz } : other;
      });
    });
  }, [planPlacement, setItems]);

  const stageView: RoomView = view === "plan" ? "miniature" : view;
  const renderPicker = (layout: "rail" | "compact", className?: string) => (
    <FurniturePicker
      layout={layout}
      className={className}
      items={library.items}
      loading={library.loading}
      failed={library.failed}
      usesPolyHaven={library.usesPolyHaven}
      placingType={placingType}
      disabled={view === "walk"}
      note={view === "walk" ? "1인칭에서는 둘러보기만 해요. 가구는 다른 시점에서 놓아 주세요." : "고른 가구는 R로 돌리고 Delete로 지워요."}
      onPick={startPlacing}
    />
  );
  const message = placingType
    ? placingMessage(placingType)
    : hint ?? VIEW_GUIDE[view];

  return (
    <>
      <ViewerHeader spaceId={spaceId} title={title}>
        {/* 좁은 화면에선 제목이 찌그러지지 않게 다음 줄로 내려 폭을 채운다 */}
        <ViewSwitch
          options={views}
          value={view}
          onChange={changeView}
          className="order-3 w-full sm:order-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
        />
        <div className="order-2 sm:order-3">
          <PanelToggleButton open={panelOpen} onToggle={() => setPanelOpen((open) => !open)} />
        </div>
      </ViewerHeader>
      <RoomTabs rooms={rooms} activeId={room.room_id} onChange={onRoomChange} />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* 넓은 화면 — 가구가 많아서 왼쪽 칸 하나를 가구 고르기에 쓴다 */}
        {panelOpen && (
          <aside aria-label="가구 놓기" className="hidden min-h-0 overflow-hidden border-r border-line lg:flex lg:w-[400px] lg:shrink-0 lg:flex-col">
            <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3">
              <h2 className="text-sm font-bold text-ink">가구 놓기</h2>
              {items.length > 0 && <span className="text-xs text-soft">{items.length}개 놓음</span>}
            </div>
            {renderPicker("rail", "min-h-0 flex-1")}
          </aside>
        )}
        <div className={cn("relative shrink-0 lg:h-auto lg:flex-1", panelOpen ? "h-[58dvh]" : "min-h-0 flex-1")}>
          <RoomStageCanvas
            imageUrl={isPlan ? null : room.image_url!}
            state={stageState}
            view={stageView}
            furnitureEditable={view === "miniature" || view === "photo"}
            placingType={placingType}
            furniture={items}
            furnitureLibraryKey={library.key}
            selectedFurniture={selectedIndex}
            onFurnitureSelect={setSelected}
            onFurnitureMove={handleStageMove}
            onPlace={handlePlace}
            onHint={setHint}
            onFurnitureLoading={setLoadingModels}
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
              onMove={handlePlanMove}
              onDragEnd={() => undefined}
              onPlace={handlePlanPlace}
              onHint={setHint}
              floorImage={floorImage}
              className="absolute inset-0 h-full w-full"
            />
          )}
          {loadingModels > 0 && view !== "plan" && (
            <p
              role="status"
              className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-ink shadow-[0_2px_10px_rgba(21,23,28,.15)]"
            >
              <IconLoader2 size={14} stroke={2.2} aria-hidden className="animate-spin" />
              가구 모델 불러오는 중{loadingModels > 1 ? ` · ${loadingModels}개` : ""}
            </p>
          )}
          {/* 선택한 가구 — 화면 아래 가운데에 띄워서, 고르고 풀 때 옆 패널이 밀리지 않게 */}
          {selectedDef && (
            <div
              role="toolbar"
              aria-label="선택한 가구"
              className="absolute bottom-14 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 border border-line bg-white p-1 pl-3 shadow-[0_2px_10px_rgba(21,23,28,.18)]"
            >
              <span className="mr-1 truncate text-sm font-semibold text-ink">{selectedDef.name}</span>
              {selectedRotatable ? (
                <>
                  <button type="button" onClick={() => rotateSelected(Math.PI / 2)} className="button button--outline button--sm" title="90° 돌리기 (R)">
                    <IconRotateClockwise2 size={15} stroke={2} aria-hidden />
                    90°
                  </button>
                  <button type="button" onClick={() => rotateSelected(Math.PI / 12)} className="button button--outline button--sm" title="15° 돌리기 (Shift+R)">
                    <IconRotate size={15} stroke={2} aria-hidden />
                    15°
                  </button>
                </>
              ) : (
                <span className="px-1 text-xs text-soft">벽을 따라 끌어 옮겨요</span>
              )}
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

        {panelOpen && (
        <aside className="flex flex-col overflow-y-auto border-line lg:w-[340px] lg:shrink-0 lg:border-l">
          {/* 좁은 화면엔 왼쪽 칸이 없어서 여기서 고른다 */}
          <div className="lg:hidden">
            <Section title="가구 놓기" summary={items.length > 0 ? `${items.length}개 놓음` : undefined}>
              {renderPicker("compact")}
            </Section>
          </div>

          <Section title="내 배치" summary={layouts.active ? `‘${layouts.active.name}’${layouts.dirty ? " · 저장 안 됨" : ""}` : layouts.dirty ? "새 배치 · 저장 안 됨" : undefined}>
            <LayoutsPanel layouts={layouts} />
          </Section>

          <Section title={rooms.length > 1 ? `방 정보 — ${room.name}` : "방 정보"} summary={`${area.toFixed(1)}㎡ · 약 ${toPyeong(area).toFixed(1)}평`}>
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
        )}
      </div>
    </>
  );
}
