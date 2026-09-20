import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaceDetailView } from "@/widgets/detail-page";

export const metadata: Metadata = { title: "공간 상세" };

/**
 * Space detail route — parses `id` from the URL and hands it to the widget,
 * which fetches the real space from the backend (`GET /spaces/{id}`).
 */
export default async function SpaceDetailPage({ params }: PageProps<"/spaces/[id]">) {
  const { id } = await params;
  const spaceId = Number(id);

  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    notFound();
  }

  return <SpaceDetailView spaceId={spaceId} />;
}
