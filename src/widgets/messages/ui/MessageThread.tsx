"use client";

import { useEffect, useLayoutEffect, useRef, useMemo, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { FileText, ImageIcon, Loader2, Plus, Send, X } from "lucide-react";
import { cn } from "@/shared/lib";
import { getErrorMessage } from "@/shared/api/error";
import { uploadImage } from "@/shared/api/upload";
import { Modal } from "@/shared/ui/Modal";
import {
  fetchChatMessages,
  MESSAGE_IMAGE_MAX_COUNT,
  MESSAGE_IMAGE_TYPES,
  parseImageMessage,
  toImageMessage,
  useChatSocket,
  validateMessageImage,
  useUnreadDmStore,
  type ChatMessage,
  type ChatRoomListItem,
} from "@/entities/message";
import { formatDividerTimestamp, partnerOf, shouldShowTimeDivider } from "../lib/partner";

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
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const lastMessageId = messages.at(-1)?.message_id;
  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [lastMessageId]);

  // 인스타그램처럼: 읽음은 대화방의 "가장 마지막 메시지"가 내가 보낸 것이고 상대가 읽었을 때만,
  // 그 메시지 밑에 표시한다. 누구든 새 메시지를 보내면 이전 읽음 표시는 사라진다.
  const lastReadOwnMessageId = useMemo(() => {
    const last = messages.at(-1);
    return last && last.sender_id === currentUserId && last.is_read ? last.message_id : null;
  }, [messages, currentUserId]);

  // ── 사진 보내기 — "+" 메뉴에서 고르면 한 장씩 올리고, 올린 순서대로 사진 메시지를 보낸다. ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  /** 크게 보고 있는 사진 — 새 탭(외부 S3 페이지)으로 보내지 않고 사이트 안 창에서 원본 비율로 띄운다. */
  const [viewingImage, setViewingImage] = useState<{ url: string; sender: string } | null>(null);

  // 메뉴 밖을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!attachOpen) return;
    function onPointerDown(event: PointerEvent) {
      if (!attachMenuRef.current?.contains(event.target as Node)) setAttachOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAttachOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [attachOpen]);

  async function handleImagesPicked(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = ""; // 같은 사진을 다시 골라도 change가 일어나게 비운다.
    if (files.length === 0) return;
    setAttachError(null);
    if (files.length > MESSAGE_IMAGE_MAX_COUNT) {
      setAttachError(`사진은 한 번에 ${MESSAGE_IMAGE_MAX_COUNT}장까지 보낼 수 있어요.`);
      return;
    }
    const invalid = files.map(validateMessageImage).find(Boolean);
    if (invalid) {
      setAttachError(invalid);
      return;
    }

    setUploading({ done: 0, total: files.length });
    try {
      for (const [index, file] of files.entries()) {
        // 대화 사진은 두 사람만 보므로 공개 공간 사진용 얼굴·번호판 자동 블라인드는 끈다(보낸 그대로 보이게).
        const url = await uploadImage(file, { privacyBlur: false });
        if (!send(toImageMessage(url))) {
          setAttachError("연결이 끊겨 사진을 보내지 못했어요. 잠시 후 다시 보내 주세요.");
          return;
        }
        setUploading({ done: index + 1, total: files.length });
      }
    } catch (uploadError) {
      setAttachError(getErrorMessage(uploadError));
    } finally {
      setUploading(null);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (send(trimmed)) setDraft("");
  }

  // ── 입력칸: Enter는 보내기, Shift+Enter는 줄바꿈. 줄이 늘면 최대 5줄까지 칸이 같이 커진다. ──
  const draftRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const textarea = draftRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [draft]);

  function handleDraftKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    // 한글 조합 중에 누른 Enter는 글자를 확정하는 용도라 보내지 않는다(안 그러면 마지막 글자가 잘리거나 두 번 간다).
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3.5 sm:px-5">
        <span
          aria-hidden
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-sky text-sm font-bold text-ink"
        >
          {partner.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <b className="block truncate text-[0.93rem] font-bold text-ink">{partner.name}</b>
          <span className="block truncate text-[0.79rem] text-soft">{room.space.name}</span>
        </div>
        <Link
          href={`/spaces/${room.space.id}`}
          className="flex-none rounded-full border border-line px-3.5 py-1.5 text-[0.78rem] font-semibold text-ink transition-colors hover:border-ink"
        >
          공간 보기
        </Link>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-wash p-4 sm:p-5">
        {isLoading && <p className="text-sm text-soft">메시지를 불러오는 중…</p>}
        {isError && <p className="text-sm text-coral">{getErrorMessage(error)}</p>}
        {!isLoading && !isError && messages.length === 0 && (
          <p className="text-sm text-soft">아직 메시지가 없어요. 먼저 말을 걸어보세요.</p>
        )}
        {messages.map((message, index) => {
          const isOwn = message.sender_id === currentUserId;
          const showTime = shouldShowTimeDivider(messages[index - 1]?.created_at, message.created_at);
          const imageUrl = parseImageMessage(message.content);
          return (
            <div key={message.message_id} className="flex flex-col gap-2.5">
              {showTime && (
                <div className="py-1 text-center text-[0.72rem] text-soft">
                  {formatDividerTimestamp(message.created_at)}
                </div>
              )}
              <div className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
              {imageUrl ? (
                <button
                  type="button"
                  onClick={() => setViewingImage({ url: imageUrl, sender: isOwn ? "내가" : `${message.sender_name}님이` })}
                  aria-label="사진 크게 보기"
                  className={cn(
                    "block max-w-[min(72%,260px)] cursor-zoom-in overflow-hidden rounded-[22px] bg-white shadow-sm",
                    isOwn ? "rounded-br-md" : "rounded-bl-md",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 서버(S3) 주소를 그대로 쓴다 */}
                  <img src={imageUrl} alt="보낸 사진" loading="lazy" className="block max-h-72 w-full object-cover" />
                </button>
              ) : (
                <div
                  className={cn(
                    "max-w-[72%] break-words whitespace-pre-wrap rounded-[22px] px-4 py-2.5 text-[0.89rem] leading-relaxed shadow-sm",
                    isOwn ? "rounded-br-md bg-main-d text-white" : "rounded-bl-md bg-white text-ink",
                  )}
                >
                  {message.content}
                </div>
              )}
              {isOwn && message.message_id === lastReadOwnMessageId && (
                <div className="mt-1 px-1 text-[0.62rem] text-soft">읽음</div>
              )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex flex-col gap-1.5 border-t border-line p-3 sm:p-4"
        onSubmit={handleSubmit}
      >
        {!connected && (
          <p className="px-1 text-xs text-soft">실시간 연결 중… 연결되면 메시지를 보낼 수 있어요.</p>
        )}
        {uploading && (
          <p role="status" className="flex items-center gap-1.5 px-1 text-xs text-soft">
            <Loader2 size={13} className="animate-spin" aria-hidden />
            사진 올리는 중… ({uploading.done}/{uploading.total})
          </p>
        )}
        {attachError && (
          <p role="alert" className="px-1 text-xs text-coral">
            {attachError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <div ref={attachMenuRef} className="relative flex-none">
            <button
              type="button"
              onClick={() => setAttachOpen((open) => !open)}
              disabled={!connected || uploading !== null}
              aria-label="첨부하기"
              aria-haspopup="menu"
              aria-expanded={attachOpen}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink transition-[transform,background-color] hover:bg-wash disabled:opacity-40",
                attachOpen && "rotate-45 bg-wash",
              )}
            >
              <Plus size={18} aria-hidden />
            </button>
            {attachOpen && (
              <div
                role="menu"
                aria-label="첨부 종류"
                className="absolute bottom-12 left-0 z-10 flex w-48 flex-col overflow-hidden rounded-2xl border border-line bg-white py-1 shadow-lg"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAttachOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-ink hover:bg-wash"
                >
                  <ImageIcon size={17} aria-hidden className="text-main-d" />
                  사진
                  <span className="ml-auto text-[0.7rem] font-normal text-soft">최대 {MESSAGE_IMAGE_MAX_COUNT}장</span>
                </button>
                {/* 일반 파일은 백엔드에 올릴 곳(업로드 API·메시지 첨부 칸)이 아직 없다 — 생기면 연결한다. */}
                <button
                  type="button"
                  role="menuitem"
                  disabled
                  aria-disabled
                  className="flex cursor-not-allowed items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-soft/70"
                >
                  <FileText size={17} aria-hidden />
                  파일
                  <span className="ml-auto text-[0.7rem] font-normal">준비 중</span>
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept={MESSAGE_IMAGE_TYPES.join(",")}
              multiple
              hidden
              onChange={handleImagesPicked}
            />
          </div>
          <textarea
            ref={draftRef}
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="메시지를 입력하세요 (Shift+Enter로 줄바꿈)"
            aria-label="메시지 입력"
            disabled={!connected}
            className="block max-h-[7.5rem] min-w-0 flex-1 resize-none overflow-y-auto rounded-[20px] border border-line bg-white px-4.5 py-2.5 text-sm leading-[1.4] outline-none focus:border-sky disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!connected || !draft.trim()}
            aria-label="전송"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-main-d text-white transition-opacity disabled:opacity-40"
          >
            <Send size={16} aria-hidden />
          </button>
        </div>
      </form>
      {viewingImage && (
        <Modal
          label="사진 크게 보기"
          onClose={() => setViewingImage(null)}
          panelClassName="flex w-full max-w-[1200px] flex-col gap-4 overflow-y-auto bg-ink p-4 sm:p-6"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="min-w-0 truncate text-sm font-bold text-white sm:text-base">{viewingImage.sender} 보낸 사진</p>
            <button type="button" onClick={() => setViewingImage(null)} className="button button--inverse shrink-0">
              <X size={18} aria-hidden />
              닫기
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 서버(S3) 원본 그대로 */}
          <img
            src={viewingImage.url}
            alt={`${viewingImage.sender} 보낸 사진 원본`}
            className="max-h-[calc(100dvh-160px)] w-full object-contain"
          />
        </Modal>
      )}
    </div>
  );
}
