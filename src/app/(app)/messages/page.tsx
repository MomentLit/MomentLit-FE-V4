import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesView } from "@/widgets/messages";

export const metadata: Metadata = { title: "메세지" };

export default function MessagesPage() {
  return (
    <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <Suspense>
        <MessagesView />
      </Suspense>
    </main>
  );
}
