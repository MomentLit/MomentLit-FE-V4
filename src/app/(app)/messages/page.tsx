import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesView } from "@/widgets/messages";

export const metadata: Metadata = { title: "메세지" };

export default function MessagesPage() {
  return (
    <main className="flex min-h-0 w-full min-w-0 flex-1">
      <Suspense>
        <MessagesView />
      </Suspense>
    </main>
  );
}
