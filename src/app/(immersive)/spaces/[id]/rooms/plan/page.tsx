import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomPlanBuilderPage } from "@/widgets/room";

export const metadata: Metadata = { title: "도면으로 3D 방 만들기" };

/**
 * 도면 이미지로 3D 방을 만드는 전체 화면. `?room=ID`면 그 도면 방을 고치고, 없으면 새로 만든다.
 * `?from=edit`이면 공간 수정으로, 그 밖엔 3D 방 관리로 돌아간다.
 */
export default async function SpacePlanRoomPage({ params, searchParams }: PageProps<"/spaces/[id]/rooms/plan">) {
  const { id } = await params;
  const { room, from } = await searchParams;
  const spaceId = Number(id);
  const roomId = typeof room === "string" ? Number(room) : null;

  if (!Number.isInteger(spaceId) || spaceId <= 0 || (roomId !== null && (!Number.isInteger(roomId) || roomId <= 0))) {
    notFound();
  }

  return <RoomPlanBuilderPage spaceId={spaceId} roomId={roomId} returnTo={from === "edit" ? "edit" : "rooms"} />;
}
