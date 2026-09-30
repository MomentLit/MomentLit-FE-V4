import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesView } from "@/widgets/messages";

export const metadata: Metadata = { title: "메세지" };

export default function MessagesPage() {
  return (
    <main className="page-shell">
      <Suspense>
        <MessagesView />
      </Suspense>
    </main>
  );
}
