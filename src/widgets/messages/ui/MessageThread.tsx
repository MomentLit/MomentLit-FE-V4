"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/shared/lib";
import { getErrorMessage } from "@/shared/api/error";
import {
  fetchChatMessages,
  useChatSocket,
  useUnreadDmStore,
  type ChatMessage,
  type ChatRoomListItem,
} from "@/entities/message";
import { formatTimestamp, partnerOf } from "../lib/partner";

const ACCESS_TOKEN_KEY = "momentlit_access_token";

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return value && value !== "null" && value !== "undefined" ? value : null;
}

/**
 * 상단 상대정보+연결공간, 메시지 버블(본인/상대 구분), 입력창+전송버튼.
 * Ported from design-reference `.thread`/`.th-top`/`.th-body`/`.bub`/`.th-in`.
 *
 * History comes from `GET /chat/:id/messages`; new messages arrive over the
 * live STOMP subscription (`useChatSocket`) and are merged in, deduped by
 * `message_id`. Sending publishes over the socket and waits for the
 * server's broadcast to render it — no optimistic bubble — so a message
 * only ever shows once it's actually persisted.
 */
export function MessageThread({
  room,
  currentUserId,
}: {
  room: ChatRoomListItem;
  currentUserId: string | undefined;
}) {
  const [draft, setDraft] = useState("");
  // Lazy initializer (not an effect) so this resolves synchronously on the
  // client's first render — reading `window` during SSR would just return
  // null anyway, and no rendered DOM depends on this value directly.
  const [accessToken] = useState<string | null>(() => readAccessToken());

  const partner = partnerOf(room, currentUserId);
  const clearUnread = useUnreadDmStore((state) => state.clearUnread);

  const {
    data: history,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["chatMessages", room.chat_room_id],
    queryFn: () => fetchChatMessages(room.chat_room_id),
    // 인스타 디엠처럼 상대가 읽으면 "읽음" 표시가 뜨게 하려면 상대의 읽음 처리(is_read)를
    // 어느 정도는 다시 물어봐야 한다 — 백엔드가 읽음 이벤트를 실시간으로 broadcast하지 않아서,
    // 채팅 자체가 이미 전제하는 것과 같은 수준의 가벼운 폴링으로 근사한다.
    refetchInterval: 5_000,
  });

  // 이 방의 히스토리를 성공적으로 불러왔다는 것 자체가 `GET /chat/:id/messages`의 서버 쪽
  // 읽음 처리(부작용)가 끝났다는 뜻이므로, 사이드바 뱃지도 같이 지운다.
  useEffect(() => {
    if (history) clearUnread(room.chat_room_id);
  }, [history, room.chat_room_id, clearUnread]);

  const { connected, liveMessages, send } = useChatSocket(room.chat_room_id, accessToken);

  const messages = useMemo(() => {
    const byId = new Map<number, ChatMessage>();
    for (const message of history ?? []) byId.set(message.message_id, message);
    for (const message of liveMessages) byId.set(message.message_id, message);
    return Array.from(byId.values()).sort((a, b) => a.message_id - b.message_id);
  }, [history, liveMessages]);

  const lastReadOwnMessageId = useMemo(() => {
    const ownRead = messages.filter((message) => message.sender_id === currentUserId && message.is_read);
    return ownRead.length > 0 ? ownRead[ownRead.length - 1].message_id : null;
  }, [messages, currentUserId]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (send(trimmed)) setDraft("");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5 sm:px-5">
        <i aria-hidden className="h-8 w-8 flex-none bg-sky" />
        <div className="min-w-0">
          <b className="block truncate text-[0.93rem] font-bold text-ink">{partner.name}</b>
          <span className="block truncate text-[0.79rem] text-soft">{room.space.name}</span>
        </div>
        <Link
          href={`/spaces/${room.space.id}`}
          className="ml-auto flex-none border border-ink px-3.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-wash"
        >
          공간 보기
        </Link>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-wash p-4 sm:p-5">
        {isLoading && <p className="text-sm text-soft">메시지를 불러오는 중…</p>}
        {isError && <p className="text-sm text-coral">{getErrorMessage(error)}</p>}
        {!isLoading && !isError && messages.length === 0 && (
          <p className="text-sm text-soft">아직 메시지가 없어요. 먼저 말을 걸어보세요.</p>
        )}
        {messages.map((message) => {
          const isOwn = message.sender_id === currentUserId;
          return (
            <div key={message.message_id} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[0.89rem] leading-relaxed",
                  isOwn
                    ? "bg-sky text-ink"
                    : "bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-line)]",
                )}
              >
                {message.content}
                <span className="mt-1 block font-mono text-[0.62rem] opacity-55">
                  {formatTimestamp(message.created_at)}
                </span>
              </div>
              {isOwn && message.message_id === lastReadOwnMessageId && (
                <span className="mt-0.5 mr-1 text-[0.62rem] text-soft">읽음</span>
              )}
            </div>
          );
        })}
      </div>

      <form className="flex flex-col gap-1.5 border-t border-line p-3 sm:p-4" onSubmit={handleSubmit}>
        {!connected && (
          <p className="px-1 text-xs text-soft">실시간 연결 중… 연결되면 메시지를 보낼 수 있어요.</p>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="메시지를 입력하세요"
            aria-label="메시지 입력"
            disabled={!connected}
            className="min-w-0 flex-1 border border-line px-4 py-2.5 text-sm outline-none focus:border-line-2 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!connected}
            className="flex-none bg-sky px-5 py-2.5 text-sm font-semibold text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </form>
    </div>
  );
}
