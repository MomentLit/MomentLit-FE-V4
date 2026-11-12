"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronDown, Send, Sparkles, X } from "lucide-react";
import { streamChatbotReply, type ChatbotSpaceCard } from "@/entities/chatbot";
import { useAuthStore } from "@/entities/auth";
import { PRICE_INQUIRY_LABEL } from "@/entities/space";
import { cn } from "@/shared/lib";

type Corner = "tl" | "tr" | "bl" | "br";

const CORNER_STORAGE_KEY = "momentlit_chatbot_corner";
const DRAG_THRESHOLD = 4;
/**
 * 놓았을 때 모서리로 붙는 움직임 — 감쇠 스프링(감쇠비 0.8, 주기 0.32s)을 0.5초 동안 샘플링한 곡선.
 * 약 1.4% 살짝 지나쳤다가 제자리로 돌아와서 Next.js 개발 아이콘처럼 "툭" 하고 안착한다.
 */
const SPRING_EASING =
  "linear(0, 0.0174 2%, 0.0624 4%, 0.1263 6%, 0.2017 8%, 0.2832 10%, 0.4074 13%, 0.5257 16%, 0.6644 20%, 0.7763 24%, 0.8613 28%, 0.9343 33%, 0.9784 38%, 1.0049 44%, 1.0142 50%, 1.0144 57%, 1.0098 65%, 1.0048 74%, 1.0012 85%, 1)";
const POSITION_TRANSITION = ["left", "right", "top", "bottom"].map((prop) => `${prop} 500ms ${SPRING_EASING}`).join(", ");
/** 속도를 잴 때 보는 최근 구간 — 손을 떼기 직전의 움직임만 본다. */
const VELOCITY_WINDOW_MS = 100;

/** 던진 속도(px/s)로 손을 뗀 뒤 더 미끄러졌을 거리를 어림한다 — 빠르게 던지면 반대쪽 모서리까지 간다. */
function projectDistance(velocity: number, deceleration = 0.998): number {
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

function edgeMargin(): number {
  return typeof window !== "undefined" && window.innerWidth >= 640 ? 24 : 16;
}

function isCorner(value: unknown): value is Corner {
  return value === "tl" || value === "tr" || value === "bl" || value === "br";
}

/** 현재 corner 기준 오프셋(pos)을 화면 절대좌표(박스 좌상단)로 바꾼다 — corner가 바뀔 때 시각적 위치를 유지한 채 좌표계만 변환하는 데 쓴다. */
function offsetToAbsolute(corner: Corner, pos: { x: number; y: number }, size: { width: number; height: number }) {
  const x = corner.endsWith("l") ? pos.x : window.innerWidth - pos.x - size.width;
  const y = corner.startsWith("t") ? pos.y : window.innerHeight - pos.y - size.height;
  return { x, y };
}

/** absoluteToOffset은 offsetToAbsolute와 같은 식의 자기 역변환이다 — 좌표계만 다시 바꿔 끼운다. */
function absoluteToOffset(corner: Corner, abs: { x: number; y: number }, size: { width: number; height: number }) {
  const x = corner.endsWith("l") ? abs.x : window.innerWidth - abs.x - size.width;
  const y = corner.startsWith("t") ? abs.y : window.innerHeight - abs.y - size.height;
  return { x, y };
}

function nearestCorner(abs: { x: number; y: number }, size: { width: number; height: number }): Corner {
  const centerX = abs.x + size.width / 2;
  const centerY = abs.y + size.height / 2;
  const top = centerY < window.innerHeight / 2;
  const left = centerX < window.innerWidth / 2;
  return `${top ? "t" : "b"}${left ? "l" : "r"}` as Corner;
}

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

function isStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<ChatMessage>;
  return (
    typeof message.id === "number" &&
    (message.role === "assistant" || message.role === "user") &&
    typeof message.text === "string" &&
    (message.spaces === undefined || Array.isArray(message.spaces))
  );
}

function formatPrice(price: number | null): string {
  if (price == null) return PRICE_INQUIRY_LABEL;
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
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const nextId = useRef(1);
  // 서버는 window/localStorage가 없어서 항상 "br"+16px로 렌더한다 — 클라이언트 첫
  // 렌더도 반드시 같은 값으로 시작해야 하이드레이션 불일치가 안 난다. 실제 저장된
  // corner/margin은 마운트 후 아래 effect에서 반영한다.
  const [corner, setCorner] = useState<Corner>("br");
  const [pos, setPos] = useState({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const posRef = useRef(pos);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPos: { x: number; y: number };
    corner: Corner;
    moved: boolean;
    /** 처음 잡은 포인터 — 다른 손가락·포인터의 움직임은 무시한다. */
    pointerId: number;
    /** 최근 포인터 위치들 — 손을 뗄 때 던진 속도를 계산한다. */
    samples: Array<{ t: number; x: number; y: number }>;
  } | null>(null);
  const justDraggedRef = useRef(false);
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hydrated = useAuthStore((state) => state.hydrated);
  const userId = useAuthStore((state) => state.user?.id);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const storageKey = hydrated && isAuthenticated && userId ? `momentlit_chatbot_history:${userId}` : null;

  useEffect(() => () => abortRef.current?.abort(), []);

  // The ChatBot API exposes a conversation ID but no history endpoint. Keep the
  // current tab's history locally so a refresh can restore both the visible
  // messages and the ID used for the next streamed prompt. The user-specific
  // key prevents one account's UI history from appearing for another account.
  useEffect(() => {
    let restoredMessages: ChatMessage[] = [initialMessage];
    let restoredConversationId: string | undefined;

    if (storageKey) {
      try {
        const raw = window.sessionStorage.getItem(storageKey);
        if (raw) {
          const saved = JSON.parse(raw) as { conversationId?: unknown; messages?: unknown };
          if (Array.isArray(saved.messages) && saved.messages.length > 0 && saved.messages.every(isStoredMessage)) {
            restoredMessages = saved.messages;
          }
          if (typeof saved.conversationId === "string") restoredConversationId = saved.conversationId;
        }
      } catch {
        // Corrupt or unavailable browser storage should never prevent chat use.
      }
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setMessages(restoredMessages);
      setConversationId(restoredConversationId);
      nextId.current = Math.max(1, ...restoredMessages.map((message) => message.id + 1));
      setLoadedStorageKey(storageKey);
    });

    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ conversationId, messages }));
    } catch {
      // Continue streaming even when browser storage is disabled or full.
    }
  }, [conversationId, loadedStorageKey, messages, storageKey]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      let storedCorner: Corner = "br";
      try {
        const raw = window.localStorage.getItem(CORNER_STORAGE_KEY);
        if (isCorner(raw)) storedCorner = raw;
      } catch {
        // Private browsing or disabled storage — default corner is fine.
      }
      const flush = { x: edgeMargin(), y: edgeMargin() };
      posRef.current = flush;
      setCorner(storedCorner);
      setPos(flush);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleResize() {
      if (dragRef.current) return;
      const flush = { x: edgeMargin(), y: edgeMargin() };
      posRef.current = flush;
      setPos(flush);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    // 주 버튼(왼쪽 클릭·트랙패드 한 손가락)으로만 끈다 — 두 손가락 클릭(오른쪽 클릭)으로는 잡히지 않게.
    if (event.button !== 0 || dragRef.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 이미 사라진 포인터면 붙잡기만 실패한다 — 끌기는 버튼 위 움직임으로 계속된다.
    }
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startPos: posRef.current,
      corner,
      moved: false,
      pointerId: event.pointerId,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId || !wrapperRef.current) return;
    // 트랙패드는 손을 뗀 신호(pointerup)가 가끔 오지 않는다. 그때 눌린 버튼 없이 움직임만 들어오면
    // 이미 손을 뗀 것으로 보고 끝낸다 — 안 그러면 버튼이 커서에 붙어 계속 따라다닌다.
    if (event.buttons === 0) {
      finishDrag(event.timeStamp);
      return;
    }
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    drag.samples.push({ t: event.timeStamp, x: event.clientX, y: event.clientY });
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > VELOCITY_WINDOW_MS) drag.samples.shift();
    if (!drag.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) drag.moved = true;
    if (!drag.moved) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const margin = 4;
    const maxX = Math.max(window.innerWidth - rect.width - margin, margin);
    const maxY = Math.max(window.innerHeight - rect.height - margin, margin);
    const nextX = Math.min(Math.max(drag.corner.endsWith("l") ? drag.startPos.x + dx : drag.startPos.x - dx, margin), maxX);
    const nextY = Math.min(Math.max(drag.corner.startsWith("t") ? drag.startPos.y + dy : drag.startPos.y - dy, margin), maxY);
    const next = { x: nextX, y: nextY };
    posRef.current = next;
    setPos(next);
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current && event.pointerId !== dragRef.current.pointerId) return;
    finishDrag(event.timeStamp);
  }

  /**
   * 끌기를 끝내고 가장 알맞은 모서리로 붙인다. 손을 뗐을 때뿐 아니라 포인터 연결이 풀렸을 때,
   * 창 포커스가 빠졌을 때, 눌린 버튼 없이 움직임이 들어왔을 때도 불러서 "끌기 중"에 갇히지 않게 한다.
   */
  function finishDrag(timeStamp: number) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const launcher = launcherRef.current;
    if (launcher?.hasPointerCapture(drag.pointerId)) launcher.releasePointerCapture(drag.pointerId);

    if (!drag.moved) {
      setIsDragging(false);
      return;
    }
    // 끌고 난 직후의 클릭은 열기로 치지 않는다. 클릭이 아예 안 오는 경우(트랙패드)에 다음 진짜 클릭까지
    // 막히지 않도록, 같은 입력 처리가 끝나면 바로 푼다.
    justDraggedRef.current = true;
    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);

    const rect = wrapperRef.current?.getBoundingClientRect();
    const size = rect ? { width: rect.width, height: rect.height } : { width: 56, height: 56 };
    const abs = offsetToAbsolute(drag.corner, posRef.current, size);
    // 놓기 직전 속도만큼 더 미끄러진 위치를 기준으로 모서리를 고른다 — 살짝 던져도 그쪽 모서리로 간다.
    const first = drag.samples[0];
    const last = drag.samples[drag.samples.length - 1];
    const elapsed = last.t - first.t;
    const recent = timeStamp - last.t < VELOCITY_WINDOW_MS && elapsed > 0;
    const velocity = recent
      ? { x: ((last.x - first.x) / elapsed) * 1000, y: ((last.y - first.y) / elapsed) * 1000 }
      : { x: 0, y: 0 };
    const projected = { x: abs.x + projectDistance(velocity.x), y: abs.y + projectDistance(velocity.y) };
    const target = nearestCorner(projected, size);

    if (target !== drag.corner) {
      const bridge = absoluteToOffset(target, abs, size);
      posRef.current = bridge;
      setCorner(target);
      setPos(bridge);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const flush = { x: edgeMargin(), y: edgeMargin() };
          posRef.current = flush;
          setIsDragging(false);
          setPos(flush);
          try {
            window.localStorage.setItem(CORNER_STORAGE_KEY, target);
          } catch {
            // Non-essential convenience — safe to skip when storage is unavailable.
          }
        });
      });
    } else {
      const flush = { x: edgeMargin(), y: edgeMargin() };
      posRef.current = flush;
      setIsDragging(false);
      setPos(flush);
    }
  }

  // 끄는 도중 다른 창·탭으로 넘어가면 손을 뗀 신호를 못 받으니 그 자리에서 끝낸다.
  const finishDragRef = useRef(finishDrag);
  useEffect(() => {
    finishDragRef.current = finishDrag;
  });
  useEffect(() => {
    const onBlur = () => finishDragRef.current(performance.now());
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, []);

  function handleLauncherClick() {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    setOpen((value) => !value);
  }

  const wrapperStyle: CSSProperties = {
    [corner.endsWith("l") ? "left" : "right"]: pos.x,
    [corner.startsWith("t") ? "top" : "bottom"]: pos.y,
    transition: isDragging ? "none" : POSITION_TRANSITION,
  };

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


  // 메시지(사람끼리 대화) 화면에서는 입력창 오른쪽 끝의 보내기 버튼을 가려서 띄우지 않는다.
  if (pathname?.startsWith("/messages")) return null;

  return (
    <div
      ref={wrapperRef}
      style={wrapperStyle}
      className={cn(
        // 필터·드롭다운·날짜 선택(z-50)보다 위, 로그인 창·모달(z-[300])보다는 아래 — 전송하면 뜨는 로그인 창을 가리지 않게.
        "fixed z-[200] flex gap-3",
        corner.startsWith("t") ? "flex-col-reverse" : "flex-col",
        corner.endsWith("l") ? "items-start" : "items-end",
      )}
    >
      {open && (
        <section className="flex h-[min(620px,calc(100dvh-7rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-wash shadow-2xl" aria-label="AI 공간 추천 챗봇">
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
              <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="예: 성수동 20명 팝업 공간" aria-label="챗봇 메시지" disabled={isStreaming} className="min-w-0 flex-1 rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-sky disabled:bg-wash" />
              <button type="submit" disabled={!draft.trim() || isStreaming} className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white transition-opacity disabled:opacity-35" aria-label="전송"><Send size={17} /></button>
            </div>
            {!isAuthenticated && <p className="mt-2 text-center text-[0.68rem] text-soft">전송하면 로그인 화면이 열려요.</p>}
          </form>
        </section>
      )}
      <button
        ref={launcherRef}
        type="button"
        onClick={handleLauncherClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        aria-expanded={open}
        aria-label={open ? "챗봇 닫기" : "맞춤 공간 추천 열기"}
        className={cn("group relative inline-flex touch-none select-none", isDragging ? "cursor-grabbing" : "cursor-grab")}
      >
        {/* 상세 "AI 소개" 카드(AiSummaryCard)의 아이콘 배지와 같은 모양 — 보라→하늘 그라데이션 원 + 빛 번짐.
            화면 구석에서 계속 움직이면 거슬려서 퍼지는 링(ping)은 넣지 않는다. 열려 있으면 닫기 화살표. */}
        <span
          className={cn(
            "pointer-events-none relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-violet to-sky text-white shadow-[0_0_22px_-2px_var(--color-violet)] transition-[transform,box-shadow] duration-200 ease-out",
            "group-hover:scale-105 group-hover:shadow-[0_0_30px_0_var(--color-violet)] group-focus-visible:scale-105 group-active:scale-95",
          )}
        >
          {open ? <ChevronDown size={20} className="relative shrink-0" /> : <Sparkles size={20} className="relative shrink-0" />}
        </span>
      </button>
    </div>
  );
}
