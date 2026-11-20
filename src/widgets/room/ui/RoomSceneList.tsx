"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { IconTrash } from "@tabler/icons-react";
import { deleteRoom, MAX_ROOMS_PER_SPACE, type Room } from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { cn } from "@/shared/lib";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import { roomPlacement, roomToDraft, summarizeRoom } from "../model";

/** 방 만들기 페이지에서 돌아올 곳 — 공간 수정에서 왔으면 공간 수정으로, 아니면 3D 방 관리로. */
export type RoomReturnTo = "edit" | "rooms";

export function roomBuilderHref(spaceId: number, sceneIndex: number, returnTo: RoomReturnTo) {
  return `/spaces/${spaceId}/rooms/edit?scene=${sceneIndex}&from=${returnTo}`;
}

export function roomReturnHref(spaceId: number, returnTo: RoomReturnTo) {
  return returnTo === "edit" ? `/spaces/${spaceId}/edit` : `/spaces/${spaceId}/rooms`;
}

/**
 * 360° 장면마다의 3D 방 목록 — 만들기·고치기(방 만들기 페이지로), 빼기(줄 안에서 한 번 더 확인하고 바로 지움).
 * 공간 수정 화면과 3D 방 관리 페이지가 같이 쓴다. `scenes`는 서버에 저장된 장면이어야 한다(방 만들기 페이지가 그 순서로 연다).
 * `locked`면 목록만 보여 주고 고칠 수 없게 한다(예: 공간 수정에서 장면을 바꾸고 아직 저장하지 않았을 때).
 */
export function RoomSceneList({ spaceId, scenes, rooms, returnTo, locked = null }: {
  spaceId: number;
  scenes: readonly PanoramaTourScene[];
  rooms: readonly Room[];
  returnTo: RoomReturnTo;
  /** 잠근 이유(보여 줄 문구). null이면 잠그지 않는다. */
  locked?: string | null;
}) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sceneUrls = new Set(scenes.map((scene) => scene.image_url));
  // 장면을 지운 뒤 남은 방 — 공간 수정 저장 때 정리되지만, 그 전이면 여기서 뺄 수 있게 보여 준다
  const orphanRooms = rooms.filter((room) => !room.scene_image_url || !sceneUrls.has(room.scene_image_url));
  const limitReached = rooms.length >= MAX_ROOMS_PER_SPACE;
  const disabled = locked !== null;

  async function remove(room: Room) {
    setDeleting(room.room_id);
    setError(null);
    try {
      await deleteRoom(spaceId, room.room_id);
      await queryClient.invalidateQueries({ queryKey: ["space-rooms", spaceId] });
      setConfirming(null);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setDeleting(null);
    }
  }

  function renderRow(key: string, label: string, room: Room | null, editHref: string | null) {
    const draft = room ? roomToDraft(room) : null;
    const summary = draft ? summarizeRoom(draft) : null;
    const isConfirming = room !== null && confirming === room.room_id;
    const canCreate = !room && !limitReached;
    return (
      <li key={key} className="flex min-h-16 items-center gap-2 py-2.5 pl-4 pr-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{label}</span>
          <span className="block text-xs text-soft">
            {isConfirming
              ? "이 3D 방과, 손님들이 이 방에 저장한 가구 배치가 지워져요."
              : room
                ? summary
                  ? `${summary.areaM2.toFixed(1)}㎡ · 약 ${summary.areaPyeong.toFixed(1)}평 · 천장 ${room.ceiling_height.toFixed(2)}m`
                  : `${room.area_m2.toFixed(1)}㎡`
                : "아직 3D 방이 없어요"}
          </span>
        </div>
        {isConfirming && room ? (
          <>
            <button type="button" onClick={() => setConfirming(null)} className="button button--outline w-[88px]">취소</button>
            <button type="button" onClick={() => void remove(room)} disabled={deleting === room.room_id} className="button button--danger w-[88px]">
              {deleting === room.room_id ? "빼는 중…" : "빼기"}
            </button>
          </>
        ) : (
          <>
            {editHref && !disabled && (room || canCreate) ? (
              <Link href={editHref} className={cn("button w-[128px]", room ? "button--outline" : "button--primary")}>
                {room ? "고치기" : "3D 방 만들기"}
              </Link>
            ) : editHref ? (
              <button type="button" disabled className={cn("button w-[128px]", room ? "button--outline" : "button--primary")}>
                {room ? "고치기" : "3D 방 만들기"}
              </button>
            ) : (
              <span className="w-[128px]" aria-hidden />
            )}
            {/* 줄마다 같은 자리 — 방이 없는 줄도 빼기 칸을 비워 둔다 */}
            <button
              type="button"
              onClick={() => room && setConfirming(room.room_id)}
              disabled={!room || disabled}
              aria-label={`${label} 3D 방 빼기`}
              title="3D 방 빼기"
              className={cn("button button--outline button--square", !room && "invisible")}
            >
              <IconTrash size={16} stroke={2} aria-hidden />
            </button>
          </>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold text-ink">360° 장면</h2>
          <span className="text-xs text-soft">3D 방 {rooms.length}/{MAX_ROOMS_PER_SPACE}</span>
        </div>
        {locked && (
          <p className="border-l-4 border-ink bg-wash px-4 py-2.5 text-sm text-ink" role="status">{locked}</p>
        )}
        <ul className="flex flex-col divide-y divide-line border border-line">
          {scenes.map((scene, index) => renderRow(
            `${scene.image_url}-${index}`,
            roomPlacement(scenes, scene.image_url).name,
            rooms.find((room) => room.scene_image_url === scene.image_url) ?? null,
            roomBuilderHref(spaceId, index, returnTo),
          ))}
        </ul>
      </div>

      {orphanRooms.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-ink">장면이 없는 3D 방</h2>
          <ul className="flex flex-col divide-y divide-line border border-line">
            {orphanRooms.map((room) => renderRow(String(room.room_id), room.name, room, null))}
          </ul>
        </div>
      )}

      {error && <p className="text-sm text-coral" role="alert">{error}</p>}
    </div>
  );
}
