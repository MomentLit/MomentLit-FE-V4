import type { Metadata } from "next";
import { SuggestionsView } from "@/widgets/suggestions";

export const metadata: Metadata = { title: "건의함" };

export default function SuggestionsPage() {
  return <SuggestionsView />;
}
