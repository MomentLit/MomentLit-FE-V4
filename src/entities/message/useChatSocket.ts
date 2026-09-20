"use client";

import { useEffect, useRef, useState } from "react";
import { Client, type IMessage } from "@stomp/stompjs";
import type { ChatMessage } from "./model";

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/^http/, "ws") + "/ws/chat";

/**
 * Live STOMP connection for one chat room — verified against source
 * (`WebSocketConfig`/`ChatMessageController`/`StompAuthChannelInterceptor`
 * in new_BE's `chating` module, no live server round-trip yet since a real
 * two-party chat needs a second logged-in user to test against):
 *  - raw STOMP over WebSocket at `/ws/chat` (no SockJS fallback)
 *  - auth via a STOMP CONNECT **frame header** named `Authorization: Bearer <jwt>`
 *    (not a WS handshake header, not a query param)
 *  - subscribe `/topic/chat/{chatRoomId}` to receive broadcasts
 *  - send to `/app/chat/{chatRoomId}` with body `{ content: string }`
 *  - the server also authorizes SUBSCRIBE against room membership, so a
 *    stale/foreign chatRoomId fails at subscribe time, not send time.
 */
export function useChatSocket(chatRoomId: number | null, accessToken: string | null) {
  const [connected, setConnected] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    if (!chatRoomId || !accessToken) return;

    // Deferred rather than a direct call: setState synchronously in an
    // effect body risks a cascading extra render (react-hooks/set-state-in-effect).
    queueMicrotask(() => setLiveMessages([]));

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 3000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/chat/${chatRoomId}`, (frame: IMessage) => {
          try {
            const body = JSON.parse(frame.body) as ChatMessage;
            setLiveMessages((prev) => [...prev, body]);
          } catch {
            // ignore malformed frames
          }
        });
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
    });

    client.activate();
    clientRef.current = client;

    return () => {
      client.deactivate();
      clientRef.current = null;
      setConnected(false);
    };
  }, [chatRoomId, accessToken]);

  function send(content: string) {
    if (!chatRoomId || !clientRef.current?.connected) return false;
    clientRef.current.publish({
      destination: `/app/chat/${chatRoomId}`,
      body: JSON.stringify({ content }),
    });
    return true;
  }

  return { connected, liveMessages, send };
}
