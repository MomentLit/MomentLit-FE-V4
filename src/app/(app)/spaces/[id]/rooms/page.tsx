import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomManager } from "@/widgets/room";

export const metadata: Metadata = { title: "3D 방 관리" };

/** 호스트가 360° 장면마다 3D 방을 만들고 관리하는 곳. `?new=1`이면 공간을 막 등록하고 온 것. */
export default async function SpaceRoomsPage({ params, searchParams }: PageProps<"/spaces/[id]/rooms">) {
  const { id } = await params;
  const { new: justCreated } = await searchParams;
  const spaceId = Number(id);

  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    notFound();
  }

  return <RoomManager spaceId={spaceId} justCreated={justCreated === "1"} />;
}
