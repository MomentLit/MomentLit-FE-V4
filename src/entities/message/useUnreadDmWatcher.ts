"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Client, type IMessage } from "@stomp/stompjs";
import { useAuthStore } from "@/entities/auth";
import { fetchChatRooms } from "./api";
import { useUnreadDmStore } from "./unread-store";
import type { ChatMessage } from "./model";

const ACCESS_TOKEN_KEY = "momentlit_access_token";
const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/^http/, "ws") + "/ws/chat";

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return value && value !== "null" && value !== "undefined" ? value : null;
}

/**
 * 로그인해 있는 동안 내가 속한 모든 DM방의 실시간 브로드캐스트(`/topic/chat/{id}`)를 하나의
 * STOMP 연결로 구독해, 지금 보고 있지 않은 방에 새 메시지가 오면 사이드바 뱃지용
 * `unreadRoomIds`에 표시한다. `useChatSocket`과 같은 브로커(`/ws/chat`)를 쓰지만 별도 연결이다
 * — 방을 연 스레드 화면은 그 방 하나만 구독하면 되고, 이건 전역적으로 여러 방을 동시에
 * 구독해야 해서 책임이 다르다.
 *
 * 새 채팅방(공간 문의) 생성은 폴링(`refetchInterval`)으로만 따라잡는다 — 방 생성 자체에
 * 실시간 알림이 없기 때문. 앱 셸에 한 번만 마운트하면 된다 (Sidebar에서 호출).
 */
export function useUnreadDmWatcher() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUserId = useAuthStore((state) => state.user?.id);
  const markUnread = useUnreadDmStore((state) => state.markUnread);
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  const { data: rooms } = useQuery({
    queryKey: ["chatRooms"],
    queryFn: fetchChatRooms,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const roomIdsKey = useMemo(
    () =>
      (rooms ?? [])
        .map((room) => room.chat_room_id)
        .sort((a, b) => a - b)
        .join(","),
    [rooms],
  );

  useEffect(() => {
    if (!isAuthenticated || !roomIdsKey) return;
    const accessToken = readAccessToken();
    if (!accessToken) return;

    const roomIds = roomIdsKey.split(",").map(Number);

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 3000,
      onConnect: () => {
        for (const roomId of roomIds) {
          client.subscribe(`/topic/chat/${roomId}`, (frame: IMessage) => {
            try {
              const message = JSON.parse(frame.body) as ChatMessage;
              const { viewingRoomId } = useUnreadDmStore.getState();
              if (message.sender_id !== currentUserIdRef.current && viewingRoomId !== roomId) {
                markUnread(roomId);
              }
            } catch {
              // ignore malformed frames
            }
          });
        }
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [isAuthenticated, roomIdsKey, markUnread]);
}
