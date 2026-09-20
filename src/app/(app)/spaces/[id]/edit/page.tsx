import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpaceEditForm } from "@/widgets/space-edit";

export const metadata: Metadata = { title: "공간 수정" };

export default async function SpaceEditPage({ params }: PageProps<"/spaces/[id]/edit">) {
  const { id } = await params;
  const spaceId = Number(id);

  if (!Number.isInteger(spaceId) || spaceId <= 0) {
    notFound();
  }

  return <SpaceEditForm spaceId={spaceId} />;
}
