"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchChatRooms } from "@/entities/message";
import { useAuthStore } from "@/entities/auth";
import { useRequireAuth } from "@/widgets/auth";
import { getErrorMessage } from "@/shared/api/error";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";

/**
 * Messages widget — conversation list + thread, backed by the real chat API
 * (`@/entities/message`) and a live STOMP subscription per open thread (see
 * `MessageThread`). Gated behind `useRequireAuth` since the whole page needs
 * a signed-in user. `?room=<id>` (from "호스트에게 문의" on a space's detail
 * page) opens that thread directly instead of defaulting to the first one.
 */
export function MessagesView() {
  const { ready } = useRequireAuth();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  const [activeId, setActiveId] = useState<number | null>(roomParam ? Number(roomParam) : null);

  const {
    data: rooms,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["chatRooms"],
    queryFn: fetchChatRooms,
    enabled: ready,
  });

  if (!ready) {
    return (
      <div className="mx-auto flex h-[calc(100vh-8rem)] min-h-[520px] max-w-6xl items-center justify-center rounded-3xl border border-line bg-white">
        <p className="text-sm text-soft">로그인이 필요한 페이지예요.</p>
      </div>
    );
  }

  const shellClass =
    "mx-auto flex h-[calc(100vh-8rem)] min-h-[520px] max-w-6xl overflow-hidden rounded-3xl border border-line bg-white";

  if (isLoading) {
    return (
      <div className={`${shellClass} items-center justify-center`}>
        <p className="text-sm text-soft">대화 목록을 불러오는 중…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`${shellClass} items-center justify-center`}>
        <p className="text-sm text-coral">{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className={`${shellClass} flex-col items-center justify-center gap-1.5`}>
        <p className="text-sm font-semibold text-ink">아직 대화가 없어요</p>
        <p className="text-xs text-soft">관심 있는 공간의 상세 페이지에서 호스트에게 문의해 보세요.</p>
      </div>
    );
  }

  const active = rooms.find((room) => room.chat_room_id === activeId) ?? rooms[0];

  return (
    <div className={shellClass}>
      <ConversationList
        rooms={rooms}
        activeId={active.chat_room_id}
        currentUserId={currentUserId}
        onSelect={setActiveId}
      />
      <MessageThread room={active} currentUserId={currentUserId} />
    </div>
  );
}
