import type { Metadata } from "next";
import { AdminSpaceList } from "@/widgets/admin";

export const metadata: Metadata = { title: "공간 승인 관리" };

export default function AdminSpacesPage() {
  return <AdminSpaceList />;
}
