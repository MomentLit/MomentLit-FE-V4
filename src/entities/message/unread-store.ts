"use client";

import { create } from "zustand";

/**
 * 안 읽은 DM 방 id 집합 — 세션 한정(비영속) 상태다. 백엔드에 "안 읽은 개수" API가 없고,
 * `GET /chat/:id/messages`는 호출하는 순간 그 방의 메시지를 읽음 처리하는 부작용이 있어서
 * (`ChatService.getChatMessages`) 사이드바 뱃지를 위해 폴링하듯 부를 수 없다. 대신 이미 연결된
 * 채팅 STOMP 소켓(`useUnreadDmWatcher`)으로 들어오는 실시간 메시지를 관찰해 뱃지를 채운다 —
 * 새로고침/재로그인 시점 이전에 쌓인 안 읽은 메시지는 이 방식으로는 알 수 없다는 한계가 있고,
 * 그 방을 실제로 열면(`GET /chat/:id/messages`) 서버 쪽 읽음 처리와 함께 여기서도 지워진다.
 */
interface UnreadDmState {
  unreadRoomIds: Set<number>;
  /** 지금 화면에 열려 있는 방 id — 이 방에 대한 실시간 메시지는 뱃지로 치지 않는다. */
  viewingRoomId: number | null;
  markUnread: (roomId: number) => void;
  clearUnread: (roomId: number) => void;
  setViewingRoomId: (roomId: number | null) => void;
}

export const useUnreadDmStore = create<UnreadDmState>((set) => ({
  unreadRoomIds: new Set(),
  viewingRoomId: null,

  markUnread(roomId) {
    set((state) => {
      if (state.unreadRoomIds.has(roomId)) return state;
      const next = new Set(state.unreadRoomIds);
      next.add(roomId);
      return { unreadRoomIds: next };
    });
  },

  clearUnread(roomId) {
    set((state) => {
      if (!state.unreadRoomIds.has(roomId)) return state;
      const next = new Set(state.unreadRoomIds);
      next.delete(roomId);
      return { unreadRoomIds: next };
    });
  },

  setViewingRoomId(roomId) {
    set({ viewingRoomId: roomId });
  },
}));
