import type { Metadata } from "next";
import { AdminSuggestionList } from "@/widgets/admin";

export const metadata: Metadata = { title: "건의 관리" };

export default function AdminSuggestionsPage() {
  return <AdminSuggestionList />;
}
