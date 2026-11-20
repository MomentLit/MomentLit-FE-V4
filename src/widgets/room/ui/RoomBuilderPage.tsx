"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createRoom, updateRoom } from "@/entities/room";
import { roomPlacement, roomToDraft, toRoomRequest, type RoomDraft } from "../model";
import { RoomBuilder } from "./RoomBuilder";
import { ROOM_ACCESS_MESSAGES, useRoomHostAccess } from "./useRoomHostAccess";

/**
 * `/spaces/{id}/rooms/edit?scene=n` — n번째 360° 장면으로 3D 방을 만들거나 고친다.
 * 저장하면 바로 서버에 저장하고(장면에 방이 있으면 덮어쓰기) 3D 방 관리로 돌아간다.
 */
export function RoomBuilderPage({ spaceId, sceneIndex }: { spaceId: number; sceneIndex: number }) {
  const { status, space, scenes, rooms } = useRoomHostAccess(spaceId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const backHref = `/spaces/${spaceId}/rooms`;

  const scene = scenes[sceneIndex];
  if (status !== "ready" || !space || !scene) {
    const message = status === "ready" ? "360° 장면을 찾을 수 없어요." : ROOM_ACCESS_MESSAGES[status as keyof typeof ROOM_ACCESS_MESSAGES];
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-10 text-sm text-soft">
        {message}
        <Link href={backHref} className="button button--outline">3D 방 관리로</Link>
      </div>
    );
  }

  const existing = rooms.find((room) => room.scene_image_url === scene.image_url) ?? null;
  const placement = roomPlacement(scenes, scene.image_url);

  async function save(draft: RoomDraft) {
    const request = toRoomRequest(draft, placement);
    if (existing) await updateRoom(spaceId, existing.room_id, request);
    else await createRoom(spaceId, request);
    await queryClient.invalidateQueries({ queryKey: ["space-rooms", spaceId] });
    router.push(backHref);
  }

  return (
    <RoomBuilder
      // 장면이 바뀌면 처음부터 다시
      key={`${scene.image_url}-${existing?.room_id ?? "new"}`}
      scene={scene}
      sceneLabel={placement.name}
      initialDraft={existing ? roomToDraft(existing) : null}
      title={space.name}
      backHref={backHref}
      onSave={save}
    />
  );
}
