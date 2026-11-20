"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { IconArrowRight, IconCube, IconTrash } from "@tabler/icons-react";
import { deleteRoom, MAX_ROOMS_PER_SPACE, type Room } from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { cn } from "@/shared/lib";
import { roomPlacement, roomToDraft, summarizeRoom } from "../model";
import { ROOM_ACCESS_MESSAGES, useRoomHostAccess } from "./useRoomHostAccess";

/**
 * `/spaces/{id}/rooms` — 호스트가 360° 장면마다 3D 방을 만들고·고치고·빼는 곳.
 * 만들기·고치기는 전체 화면 페이지(`/spaces/{id}/rooms/edit?scene=n`)로 가고, 빼기는 여기서 바로 서버에서 지운다.
 * 공간을 막 등록하고 왔으면(`justCreated`) 이어서 만들도록 안내한다.
 */
export function RoomManager({ spaceId, justCreated = false }: { spaceId: number; justCreated?: boolean }) {
  const { status, space, scenes, rooms } = useRoomHostAccess(spaceId);
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status !== "ready" || !space) {
    return <div className="flex-1 p-10 text-sm text-soft">{ROOM_ACCESS_MESSAGES[status as keyof typeof ROOM_ACCESS_MESSAGES]}</div>;
  }

  const sceneUrls = new Set(scenes.map((scene) => scene.image_url));
  // 장면을 지운 뒤 남은 방 — 공간 수정 저장 때 정리되지만, 그 전이면 여기서 뺄 수 있게 보여 준다
  const orphanRooms = rooms.filter((room) => !room.scene_image_url || !sceneUrls.has(room.scene_image_url));
  const limitReached = rooms.length >= MAX_ROOMS_PER_SPACE;

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
            {editHref ? (
              <Link
                href={editHref}
                aria-disabled={!room && limitReached}
                className={cn("button w-[128px]", room ? "button--outline" : "button--primary", !room && limitReached && "pointer-events-none opacity-50")}
              >
                {room ? "고치기" : "3D 방 만들기"}
              </Link>
            ) : (
              <span className="w-[128px]" aria-hidden />
            )}
            {/* 줄마다 같은 자리 — 방이 없는 줄도 빼기 칸을 비워 둔다 */}
            <button
              type="button"
              onClick={() => room && setConfirming(room.room_id)}
              disabled={!room}
              aria-label={`${label} 3D 방 빼기`}
              title="3D 방 빼기"
              className={cn("button button--outline w-11 px-0", !room && "invisible")}
            >
              <IconTrash size={16} stroke={2} aria-hidden />
            </button>
          </>
        )}
      </li>
    );
  }

  return (
    <div className="flex w-full max-w-[880px] flex-1 flex-col gap-6 p-5 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">3D Room</span>
          <h1 className="section-title text-ink">3D 방 관리</h1>
          <p className="mt-1 truncate text-sm text-soft">{space.name}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/spaces/${spaceId}`} className="button button--outline">공간 보기</Link>
          {rooms.length > 0 && (
            <Link href={`/spaces/${spaceId}/room`} className="button button--primary">
              <IconCube size={18} stroke={2} aria-hidden />
              3D로 보기
            </Link>
          )}
        </div>
      </div>

      {justCreated && (
        <div className="flex flex-wrap items-center gap-3 border-l-4 border-ink bg-wash px-4.5 py-3.5">
          <p className="min-w-0 flex-1 text-sm text-ink">
            공간을 등록했어요. 360° 장면마다 3D 방을 만들면 손님이 미니어처·1인칭으로 둘러보고 가구를 놓아 볼 수 있어요.
          </p>
          <Link href={`/spaces/${spaceId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-soft hover:text-ink">
            나중에 할게요
            <IconArrowRight size={14} stroke={2} aria-hidden />
          </Link>
        </div>
      )}

      {scenes.length === 0 ? (
        <div className="flex flex-col items-start gap-3 border border-line p-6">
          <p className="text-sm text-ink">3D 방은 360° 사진으로 만들어요. 먼저 공간 수정에서 360° 사진을 추가해 주세요.</p>
          <Link href={`/spaces/${spaceId}/edit`} className="button button--outline">공간 수정으로</Link>
        </div>
      ) : (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-ink">360° 장면</h2>
            <span className="text-xs text-soft">3D 방 {rooms.length}/{MAX_ROOMS_PER_SPACE}</span>
          </div>
          <ul className="flex flex-col divide-y divide-line border border-line">
            {scenes.map((scene, index) => renderRow(
              `${scene.image_url}-${index}`,
              roomPlacement(scenes, scene.image_url).name,
              rooms.find((room) => room.scene_image_url === scene.image_url) ?? null,
              `/spaces/${spaceId}/rooms/edit?scene=${index}`,
            ))}
          </ul>
          <p className="text-xs text-soft">
            장면을 추가하거나 사진을 바꾸려면 공간 수정에서 해 주세요. 만든 3D 방은 저장하는 즉시 손님에게 보여요.
          </p>
        </section>
      )}

      {orphanRooms.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-bold text-ink">장면이 없는 3D 방</h2>
          <ul className="flex flex-col divide-y divide-line border border-line">
            {orphanRooms.map((room) => renderRow(String(room.room_id), room.name, room, null))}
          </ul>
        </section>
      )}

      {error && <p className="text-sm text-coral" role="alert">{error}</p>}
    </div>
  );
}
