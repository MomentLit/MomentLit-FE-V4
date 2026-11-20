"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { deleteRoom, MAX_ROOMS_PER_SPACE, type Room } from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { cn } from "@/shared/lib";
import { ConfirmDialog } from "@/shared/ui";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import { roomPlacement, roomToDraft, summarizeRoom } from "../model";

/** 방 만들기 페이지에서 돌아올 곳 — 공간 수정에서 왔으면 공간 수정으로, 아니면 3D 방 관리로. */
export type RoomReturnTo = "edit" | "rooms";

export function roomBuilderHref(spaceId: number, sceneIndex: number, returnTo: RoomReturnTo) {
  return `/spaces/${spaceId}/rooms/edit?scene=${sceneIndex}&from=${returnTo}`;
}

/** 도면 방 만들기(roomId 없음)·고치기 페이지. */
export function planRoomBuilderHref(spaceId: number, roomId: number | null, returnTo: RoomReturnTo) {
  return `/spaces/${spaceId}/rooms/plan?${roomId === null ? "" : `room=${roomId}&`}from=${returnTo}`;
}

export function roomReturnHref(spaceId: number, returnTo: RoomReturnTo) {
  return returnTo === "edit" ? `/spaces/${spaceId}/edit` : `/spaces/${spaceId}/rooms`;
}

/**
 * 360° 장면과 도면으로 만든 3D 방 목록. 편집 페이지에서 만들거나 고치고, 확인 모달을 거쳐 삭제한다.
 * 공간 수정 화면과 3D 방 관리 페이지가 같이 쓴다. `scenes`는 서버에 저장된 장면이어야 한다(방 만들기 페이지가 그 순서로 연다).
 * `locked`면 목록만 보여 주고 고칠 수 없게 한다(예: 공간 수정에서 장면을 바꾸고 아직 저장하지 않았을 때).
 */
export function RoomSceneList({ spaceId, scenes, rooms, returnTo, locked = null, busy = false, onOpen }: {
  spaceId: number;
  scenes: readonly PanoramaTourScene[];
  rooms: readonly Room[];
  returnTo: RoomReturnTo;
  /** 잠근 이유(보여 줄 문구). null이면 잠그지 않는다. */
  locked?: string | null;
  /** 저장 중 등으로 잠시 누를 수 없게 할 때. */
  busy?: boolean;
  /**
   * 만들기·고치기를 누르면 링크로 바로 가지 않고 이걸 부른다 — 공간 수정처럼 먼저 저장해야 할 때.
   * 없으면 그냥 링크로 간다.
   */
  onOpen?: (href: string) => void;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<{ room: Room; label: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sceneUrls = new Set(scenes.map((scene) => scene.image_url));
  // 장면을 지운 뒤 남은 방 — 공간 수정 저장 때 정리되지만, 그 전이면 여기서 뺄 수 있게 보여 준다
  const orphanRooms = rooms.filter((room) => room.source !== "PLAN" && (!room.scene_image_url || !sceneUrls.has(room.scene_image_url)));
  const planRooms = rooms.filter((room) => room.source === "PLAN");
  const limitReached = rooms.length >= MAX_ROOMS_PER_SPACE;
  const disabled = locked !== null || busy;

  async function remove(room: Room) {
    setDeleting(true);
    setError(null);
    try {
      await deleteRoom(spaceId, room.room_id);
      await queryClient.invalidateQueries({ queryKey: ["space-rooms", spaceId] });
      setConfirming(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  }

  function renderRow(key: string, label: string, room: Room | null, editHref: string | null) {
    const draft = room && room.source !== "PLAN" ? roomToDraft(room) : null;
    const summary = draft ? summarizeRoom(draft) : null;
    const canCreate = !room && !limitReached;
    return (
      <li key={key} className="flex min-h-16 items-center gap-2 py-2.5 pl-4 pr-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{label}</span>
          {/* 항목 단위로만 줄을 바꾼다(좁은 화면에서 "천장 / 2.40m"처럼 끊기지 않게) */}
          <span className="flex flex-wrap gap-x-1 text-xs text-soft">
            {room
              ? [
                `${(summary?.areaM2 ?? room.area_m2).toFixed(1)}㎡`,
                `약 ${(summary?.areaPyeong ?? room.area_pyeong).toFixed(1)}평`,
                `천장 ${room.ceiling_height.toFixed(2)}m`,
              ].map((item, index) => (
                <span key={item} className="whitespace-nowrap">{index > 0 && "· "}{item}</span>
              ))
              : "아직 3D 방이 없어요"}
          </span>
        </div>
        {editHref && !disabled && (room || canCreate) && onOpen ? (
          <button type="button" onClick={() => onOpen(editHref)} className={cn("button w-28 shrink-0 whitespace-nowrap sm:w-32", room ? "button--outline" : "button--primary")}>
            {room ? "고치기" : "3D 방 만들기"}
          </button>
        ) : editHref && !disabled && (room || canCreate) ? (
          <Link href={editHref} className={cn("button w-28 shrink-0 whitespace-nowrap sm:w-32", room ? "button--outline" : "button--primary")}>
            {room ? "고치기" : "3D 방 만들기"}
          </Link>
        ) : editHref ? (
          <button type="button" disabled className={cn("button w-28 shrink-0 whitespace-nowrap sm:w-32", room ? "button--outline" : "button--primary")}>
            {room ? "고치기" : "3D 방 만들기"}
          </button>
        ) : (
          <span className="w-28 shrink-0 whitespace-nowrap sm:w-32" aria-hidden />
        )}
        {/* 방이 있는 줄만 빼기 버튼 — 없는 줄은 '3D 방 만들기'가 오른쪽 끝에 붙는다 */}
        {room && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirming({ room, label });
            }}
            disabled={disabled}
            aria-label={`${label} 3D 방 빼기`}
            title="3D 방 빼기"
            className="button button--outline button--square"
          >
            <IconTrash size={16} stroke={2} aria-hidden />
          </button>
        )}
      </li>
    );
  }

  // 만든 방 수 — 첫 제목 줄 오른쪽에
  const counter = <span className="shrink-0 text-xs text-soft">3D 방 {rooms.length}/{MAX_ROOMS_PER_SPACE}</span>;

  return (
    <div className="flex flex-col gap-4">
      {locked && (
        <p className="border-l-4 border-ink bg-wash px-4 py-2.5 text-sm text-ink" role="status">{locked}</p>
      )}

      {scenes.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-bold text-ink">360° 장면</h2>
            {counter}
          </div>
          <ul className="flex flex-col divide-y divide-line border border-line">
            {scenes.map((scene, index) => renderRow(
              `${scene.image_url}-${index}`,
              roomPlacement(scenes, scene.image_url).name,
              rooms.find((room) => room.scene_image_url === scene.image_url) ?? null,
              roomBuilderHref(spaceId, index, returnTo),
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">도면으로 만든 방</h2>
          {scenes.length === 0 && counter}
        </div>
        {planRooms.length > 0 && (
          <ul className="flex flex-col divide-y divide-line border border-line">
            {planRooms.map((room) => renderRow(String(room.room_id), room.name, room, planRoomBuilderHref(spaceId, room.room_id, returnTo)))}
          </ul>
        )}
        {(() => {
          const href = planRoomBuilderHref(spaceId, null, returnTo);
          const className = "button button--outline w-full";
          const label = limitReached
            ? `3D 방은 ${MAX_ROOMS_PER_SPACE}개까지 만들 수 있어요`
            : <><IconPlus size={16} stroke={2} aria-hidden />도면으로 방 추가</>;
          if (disabled || limitReached) return <button type="button" disabled className={className}>{label}</button>;
          if (onOpen) return <button type="button" onClick={() => onOpen(href)} className={className}>{label}</button>;
          return <Link href={href} className={className}>{label}</Link>;
        })()}
      </div>

      {orphanRooms.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-ink">장면이 없는 3D 방</h2>
          <ul className="flex flex-col divide-y divide-line border border-line">
            {orphanRooms.map((room) => renderRow(String(room.room_id), room.name, room, null))}
          </ul>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={`‘${confirming.label}’ 3D 방을 뺄까요?`}
          confirmLabel="빼기"
          busyLabel="빼는 중…"
          busy={deleting}
          error={error}
          onConfirm={() => void remove(confirming.room)}
          onCancel={() => setConfirming(null)}
        >
          이 3D 방과, 손님들이 이 방에 저장한 가구 배치가 함께 지워져요. 되돌릴 수 없어요.
        </ConfirmDialog>
      )}

      {error && !confirming && <p className="text-sm text-coral" role="alert">{error}</p>}
    </div>
  );
}
