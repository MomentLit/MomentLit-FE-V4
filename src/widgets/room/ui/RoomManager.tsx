"use client";

import Link from "next/link";
import { IconArrowLeft, IconArrowRight, IconCube } from "@tabler/icons-react";
import { RoomSceneList } from "./RoomSceneList";
import { ROOM_ACCESS_MESSAGES, useRoomHostAccess } from "./useRoomHostAccess";

/**
 * `/spaces/{id}/rooms` — 호스트가 360° 장면마다 3D 방을 만들고·고치고·빼는 곳(등록 직후·공간 상세에서 들어온다).
 * 공간 수정에도 같은 목록이 있고, 이 페이지에서 뒤로 가면 공간 수정으로 간다.
 * 공간을 막 등록하고 왔으면(`justCreated`) 이어서 만들도록 안내한다.
 */
export function RoomManager({ spaceId, justCreated = false }: { spaceId: number; justCreated?: boolean }) {
  const { status, space, scenes, rooms } = useRoomHostAccess(spaceId);

  if (status !== "ready" || !space) {
    return <div className="flex-1 p-10 text-sm text-soft">{ROOM_ACCESS_MESSAGES[status as keyof typeof ROOM_ACCESS_MESSAGES]}</div>;
  }

  return (
    <div className="flex w-full max-w-[880px] flex-1 flex-col gap-6 p-5 sm:p-10">
      <div className="flex flex-col gap-4">
        <Link href={`/spaces/${spaceId}/edit`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-soft hover:text-ink">
          <IconArrowLeft size={16} stroke={2} aria-hidden />
          공간 수정
        </Link>
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
      </div>

      {justCreated && (
        <div className="flex flex-wrap items-center gap-3 border-l-4 border-ink bg-wash px-4.5 py-3.5">
          <p className="min-w-0 flex-1 text-sm text-ink">
            공간을 등록했어요. 360° 장면이나 평면 도면으로 3D 방을 만들면 손님이 둘러보고 가구를 놓아 볼 수 있어요.
          </p>
          <Link href={`/spaces/${spaceId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-soft hover:text-ink">
            나중에 할게요
            <IconArrowRight size={14} stroke={2} aria-hidden />
          </Link>
        </div>
      )}

      <RoomSceneList spaceId={spaceId} scenes={scenes} rooms={rooms} returnTo="rooms" />
      <p className="-mt-3 text-xs text-soft">
        {scenes.length === 0
          ? "360° 사진이 있으면 장면마다 3D 방을 자동으로 잡아 줘요 — 공간 수정에서 추가할 수 있어요. "
          : "장면을 추가하거나 사진을 바꾸려면 공간 수정에서 해 주세요. "}
        만든 3D 방은 저장하는 즉시 손님에게 보여요.
      </p>
    </div>
  );
}
