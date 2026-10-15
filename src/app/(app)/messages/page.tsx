import { Suspense } from "react";
import type { Metadata } from "next";
import { MessagesView } from "@/widgets/messages";

export const metadata: Metadata = { title: "메세지" };

export default function MessagesPage() {
  return (
    // 페이지 전체가 아니라 대화 목록·스레드가 각자 스크롤되도록 화면 높이에 고정한다
    // (모바일은 상단 바 73px을 뺀 높이, md 이상은 사이드바와 같은 100dvh).
    <main className="flex h-[calc(100dvh-73px)] w-full min-w-0 flex-none overflow-hidden md:h-dvh md:flex-1">
      <Suspense>
        <MessagesView />
      </Suspense>
    </main>
  );
}
