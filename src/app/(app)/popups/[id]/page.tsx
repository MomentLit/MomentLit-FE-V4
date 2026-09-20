import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PopupDetailView } from "@/widgets/popup-detail";

export const metadata: Metadata = { title: "팝업 상세" };

/** Popup detail route — mirrors `spaces/[id]`, fetches the real popup (`GET /popups/{id}`). */
export default async function PopupDetailPage({ params }: PageProps<"/popups/[id]">) {
  const { id } = await params;
  const popupId = Number(id);

  if (!Number.isInteger(popupId) || popupId <= 0) {
    notFound();
  }

  return <PopupDetailView popupId={popupId} />;
}
