import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RoomBuilderPage } from "@/widgets/room";

export const metadata: Metadata = { title: "3D 방 만들기" };

/**
 * 360° 장면 하나로 3D 방을 만드는 전체 화면(사이드바 없는 `(immersive)` 그룹). `?scene=n`은 장면 순서(0부터).
 */
export default async function SpaceRoomEditPage({ params, searchParams }: PageProps<"/spaces/[id]/rooms/edit">) {
  const { id } = await params;
  const { scene } = await searchParams;
  const spaceId = Number(id);
  const sceneIndex = Number(typeof scene === "string" ? scene : 0);

  if (!Number.isInteger(spaceId) || spaceId <= 0 || !Number.isInteger(sceneIndex) || sceneIndex < 0) {
    notFound();
  }

  return <RoomBuilderPage spaceId={spaceId} sceneIndex={sceneIndex} />;
}
