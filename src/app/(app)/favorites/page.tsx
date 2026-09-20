import type { Metadata } from "next";
import { FavoritesView } from "@/widgets/favorites";

export const metadata: Metadata = { title: "관심 공간" };

export default function FavoritesPage() {
  return <FavoritesView />;
}
