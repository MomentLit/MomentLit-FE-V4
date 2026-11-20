"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createRoom, updateRoom } from "@/entities/room";
import { nextPlanSortOrder, roomToPlanDraft, toPlanRoomRequest, type PlanDraft } from "../planModel";
import { RoomPlanBuilder } from "./RoomPlanBuilder";
import { roomReturnHref, type RoomReturnTo } from "./RoomSceneList";
import { ROOM_ACCESS_MESSAGES, useRoomHostAccess } from "./useRoomHostAccess";

/**
 * `/spaces/{id}/rooms/plan?room=ID&from=edit|rooms` — 도면 이미지로 3D 방을 만들거나(room 없음) 고친다.
 * 저장하면 바로 서버에 저장하고 들어온 곳으로 돌아간다.
 */
export function RoomPlanBuilderPage({ spaceId, roomId, returnTo }: { spaceId: number; roomId: number | null; returnTo: RoomReturnTo }) {
  const { status, space, rooms } = useRoomHostAccess(spaceId);
  const router = useRouter();
  const queryClient = useQueryClient();
  const backHref = roomReturnHref(spaceId, returnTo);
  const backLabel = returnTo === "edit" ? "공간 수정" : "3D 방 관리";

  const existing = roomId === null ? null : rooms.find((room) => room.room_id === roomId && room.source === "PLAN") ?? null;
  const initialDraft = existing ? roomToPlanDraft(existing) : null;
  if (status !== "ready" || !space || (roomId !== null && !initialDraft)) {
    const message = status === "ready" ? "도면 방을 찾을 수 없어요." : ROOM_ACCESS_MESSAGES[status as keyof typeof ROOM_ACCESS_MESSAGES];
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 p-10 text-sm text-soft">
        {message}
        <Link href={backHref} className="button button--outline">{backLabel}(으)로</Link>
      </div>
    );
  }

  const planCount = rooms.filter((room) => room.source === "PLAN").length;
  const defaultName = existing?.name ?? `도면 ${planCount + 1}`;

  async function save(draft: PlanDraft) {
    const request = toPlanRoomRequest(draft, existing?.sort_order ?? nextPlanSortOrder(rooms));
    if (existing) await updateRoom(spaceId, existing.room_id, request);
    else await createRoom(spaceId, request);
    await queryClient.invalidateQueries({ queryKey: ["space-rooms", spaceId] });
    router.push(backHref);
  }

  return (
    <RoomPlanBuilder
      key={existing?.room_id ?? "new"}
      initialDraft={initialDraft}
      defaultName={defaultName}
      title={space.name}
      backHref={backHref}
      backLabel={backLabel}
      onSave={save}
    />
  );
}
