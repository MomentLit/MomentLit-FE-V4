import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomViewer } from "@/widgets/room";

export const metadata: Metadata = { title: "3D 방" };

/**
 * 공간의 3D 방을 화면 가득 보여 주는 페이지 — 사이드바·챗봇이 있는 `(app)` 레이아웃 밖에 둔다.
 * URL은 `/spaces/{id}/room` (route group은 URL에 영향 없음, `(app)/spaces/[id]`와 경로가 겹치지 않음).
 */
export default async function SpaceRoomPage({ params }: PageProps<"/spaces/[id]/room">) {
  const { id } = await params;
  const spaceId = Number(id);

  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    notFound();
  }

  return <RoomViewer spaceId={spaceId} />;
}
