"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchChatRooms, useUnreadDmStore, type ChatRoomListItem } from "@/entities/message";
import { useAuthStore } from "@/entities/auth";
import { useRequireAuth } from "@/widgets/auth";
import { getErrorMessage } from "@/shared/api/error";
import { ConversationList } from "./ConversationList";
import { MessageThread } from "./MessageThread";

const SHELL_CLASS =
  "flex h-[calc(100dvh-8rem)] min-h-[320px] w-full min-w-0 overflow-hidden border border-line bg-white";

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
      <div className={`${SHELL_CLASS} items-center justify-center`}>
        <p className="text-sm text-soft">로그인이 필요한 페이지예요.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${SHELL_CLASS} items-center justify-center`}>
        <p className="text-sm text-soft">대화 목록을 불러오는 중…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`${SHELL_CLASS} items-center justify-center`}>
        <p className="text-sm text-coral">{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (!rooms || rooms.length === 0) {
    return (
      <div className={`${SHELL_CLASS} flex-col items-center justify-center gap-1.5`}>
        <p className="text-sm font-semibold text-ink">아직 대화가 없어요</p>
        <p className="text-xs text-soft">관심 있는 공간의 상세 페이지에서 호스트에게 문의해 보세요.</p>
      </div>
    );
  }

  const active = rooms.find((room) => room.chat_room_id === activeId) ?? rooms[0];

  return (
    <MessagesViewBody rooms={rooms} active={active} currentUserId={currentUserId} onSelect={setActiveId} initiallyOpen={roomParam !== null} />
  );
}

/**
 * 지금 열려 있는 방 id를 `useUnreadDmStore`에 반영 — 그 방으로 실시간 메시지가 와도
 * 사이드바 뱃지로 치지 않게(이미 보고 있으니) 하고, 페이지를 벗어나거나 방을 바꾸면
 * 다시 null/새 id로 되돌린다. 훅 순서를 지키려고 상위 컴포넌트의 이른 return들 밖으로 뺐다.
 */
function MessagesViewBody({
  rooms,
  active,
  currentUserId,
  onSelect,
  initiallyOpen,
}: {
  rooms: ChatRoomListItem[];
  active: ChatRoomListItem;
  currentUserId: string | undefined;
  onSelect: (id: number) => void;
  initiallyOpen: boolean;
}) {
  const [threadOpen, setThreadOpen] = useState(initiallyOpen);
  const isMobile = useSyncExternalStore(subscribeMobile, getMobileSnapshot, () => false);
  const threadVisible = !isMobile || threadOpen;
  const setViewingRoomId = useUnreadDmStore((state) => state.setViewingRoomId);

  useEffect(() => {
    setViewingRoomId(threadVisible ? active.chat_room_id : null);
    return () => setViewingRoomId(null);
  }, [active.chat_room_id, setViewingRoomId, threadVisible]);

  return (
    <div className={SHELL_CLASS}>
      <div className={`${threadOpen ? "hidden" : "flex"} min-h-0 w-full flex-none md:flex md:w-[280px]`}>
        <ConversationList rooms={rooms} activeId={active.chat_room_id} currentUserId={currentUserId} onSelect={(id) => { onSelect(id); setThreadOpen(true); }} />
      </div>
      {threadVisible && (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <button type="button" onClick={() => setThreadOpen(false)} className="min-h-11 border-b border-line px-4 text-left text-sm font-bold md:hidden">← 대화 목록</button>
          <MessageThread key={active.chat_room_id} room={active} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  );
}

function getMobileSnapshot() { return window.matchMedia("(max-width: 767px)").matches; }
function subscribeMobile(callback: () => void) {
  const media = window.matchMedia("(max-width: 767px)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
