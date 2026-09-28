"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Bot, ChevronDown, Send, Sparkles, X } from "lucide-react";
import { streamChatbotReply, type ChatbotSpaceCard } from "@/entities/chatbot";
import { useAuthStore } from "@/entities/auth";
import { cn } from "@/shared/lib";

interface ChatMessage {
  id: number;
  role: "assistant" | "user";
  text: string;
  spaces?: ChatbotSpaceCard[];
}

const initialMessage: ChatMessage = {
  id: 0,
  role: "assistant",
  text: "어떤 공간을 찾고 계신가요? 지역, 용도, 예산을 알려주시면 추천해 드릴게요.",
};

function formatPrice(price: number): string {
  return `${new Intl.NumberFormat("ko-KR").format(price)}원 / 시간`;
}

function SpaceCards({ spaces }: { spaces: ChatbotSpaceCard[] }) {
  return (
    <div className="mt-3 grid gap-2">
      {spaces.map((space) => (
        <Link
          key={space.id}
          href={`/spaces/${space.id}`}
          className="flex overflow-hidden rounded-xl border border-line bg-white text-left transition-transform hover:-translate-y-0.5"
        >
          {space.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- chatbot returns external image URLs.
            <img src={space.thumbnail_url} alt="" className="h-16 w-16 flex-none object-cover" />
          ) : (
            <div className="h-16 w-16 flex-none bg-sky" aria-hidden />
          )}
          <span className="min-w-0 p-2">
            <b className="block truncate text-xs text-ink">{space.name}</b>
            <span className="mt-0.5 block truncate text-[0.68rem] text-soft">{space.address}</span>
            <span className="mt-0.5 block text-[0.68rem] font-semibold text-ink">{formatPrice(space.price_per_hour)}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Fixed AI space-recommendation assistant. It consumes POST-based SSE, rather than the app's STOMP user chat. */
export function ChatbotDrawer() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [conversationId, setConversationId] = useState<string>();
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  useEffect(() => () => abortRef.current?.abort(), []);

  function close() {
    abortRef.current?.abort();
    setOpen(false);
    setIsStreaming(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isStreaming) return;
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    const assistantId = nextId.current + 1;
    nextId.current += 2;
    setMessages((previous) => [...previous, { id: assistantId - 1, role: "user", text: message }, { id: assistantId, role: "assistant", text: "" }]);
    setDraft("");
    setError(null);
    setIsStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChatbotReply(
        { message, ...(conversationId ? { conversation_id: conversationId } : {}) },
        (sseEvent) => {
          if (sseEvent.type === "conversation") {
            setConversationId(sseEvent.conversationId);
            return;
          }
          if (sseEvent.type === "delta") {
            setMessages((previous) => previous.map((item) => (item.id === assistantId ? { ...item, text: item.text + sseEvent.text } : item)));
            return;
          }
          if (sseEvent.type === "space_cards") {
            setMessages((previous) => previous.map((item) => (item.id === assistantId ? { ...item, spaces: sseEvent.spaces } : item)));
            return;
          }
          if (sseEvent.type === "done") {
            setMessages((previous) => previous.map((item) => (item.id === assistantId ? { ...item, text: sseEvent.result.text } : item)));
          }
        },
        controller.signal,
      );
    } catch (streamError) {
      if (!controller.signal.aborted) {
        setMessages((previous) => previous.filter((item) => item.id !== assistantId));
        setError(streamError instanceof Error ? streamError.message : "챗봇 응답을 불러오지 못했어요.");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsStreaming(false);
      }
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6">
      {open && (
        <section className="mb-3 flex h-[min(620px,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-wash shadow-2xl" aria-label="AI 공간 추천 챗봇">
          <header className="flex items-center gap-2 border-b border-line bg-white px-4 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky text-ink"><Bot size={19} /></span>
            <span className="min-w-0 flex-1"><b className="block text-sm">AI 공간 추천</b><span className="block text-[0.68rem] text-soft">실시간으로 맞춤 공간을 찾아드려요</span></span>
            <button type="button" onClick={close} className="grid h-8 w-8 place-items-center rounded-full text-soft hover:bg-wash hover:text-ink" aria-label="챗봇 닫기"><X size={18} /></button>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {messages.map((message) => (
              <div key={message.id} className={cn("max-w-[88%] text-sm leading-relaxed", message.role === "user" ? "self-end" : "self-start")}>
                <div className={cn("rounded-2xl px-3.5 py-2.5", message.role === "user" ? "bg-sky text-ink" : "bg-white text-ink shadow-[inset_0_0_0_1px_var(--color-line)]")}>
                  {message.text || (isStreaming && <span className="text-soft">답변을 작성하고 있어요…</span>)}
                </div>
                {message.spaces && <SpaceCards spaces={message.spaces} />}
              </div>
            ))}
            {error && <p className="rounded-xl bg-rose/20 px-3 py-2 text-xs text-ink">{error}</p>}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-line bg-white p-3">
            <div className="flex gap-2">
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="예: 성수동 20명 팝업 공간" aria-label="챗봇 메시지" disabled={isStreaming} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-ink disabled:bg-wash" />
              <button type="submit" disabled={!draft.trim() || isStreaming} className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white transition-opacity disabled:opacity-35" aria-label="전송"><Send size={17} /></button>
            </div>
            {!isAuthenticated && <p className="mt-2 text-center text-[0.68rem] text-soft">전송하면 로그인 화면이 열려요.</p>}
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-bold text-white shadow-lg transition-transform hover:-translate-y-0.5" aria-expanded={open} aria-label={open ? "챗봇 닫기" : "AI 공간 추천 열기"}>
        {open ? <ChevronDown size={18} /> : <Sparkles size={18} />} AI 추천
      </button>
    </div>
  );
}
