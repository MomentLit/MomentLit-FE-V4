import type { ChatbotDone, ChatbotSpaceCard, ChatbotStreamEvent, ChatbotStreamRequest } from "./model";

const ACCESS_TOKEN_KEY = "momentlit_access_token";

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return token && token !== "null" && token !== "undefined" ? token : null;
}

function apiUrl(path: string): string {
  // ChatBot is deployed separately from the Spring API, so it has its own
  // public build-time environment variable.
  const baseUrl = process.env.NEXT_PUBLIC_CHATBOT_API_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("챗봇 서버 주소가 설정되지 않았어요.");
  return `${baseUrl}${path}`;
}

function eventFromSseBlock(block: string): ChatbotStreamEvent | null {
  let eventName = "message";
  const data: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) eventName = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }

  const value = data.join("\n");
  if (!value) return null;

  if (eventName === "conversation") return { type: "conversation", conversationId: value };
  if (eventName === "delta") return { type: "delta", text: value };

  try {
    if (eventName === "space_cards") {
      const spaces = JSON.parse(value) as ChatbotSpaceCard[];
      return Array.isArray(spaces) ? { type: "space_cards", spaces } : null;
    }
    if (eventName === "done") return { type: "done", result: JSON.parse(value) as ChatbotDone };
  } catch {
    throw new Error("챗봇 응답 형식을 읽지 못했어요.");
  }

  return null;
}

/**
 * Consumes the HTTP SSE response from `POST /chat/stream`.
 *
 * This deliberately uses `fetch`, not EventSource: EventSource only supports GET
 * and cannot include the required Bearer header or JSON request body.
 */
export async function streamChatbotReply(
  request: ChatbotStreamRequest,
  onEvent: (event: ChatbotStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = readAccessToken();
  if (!token) throw new Error("로그인 후 AI 공간 추천을 이용해 주세요.");

  const response = await fetch(apiUrl("/chat/stream"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok) {
    let message = "챗봇 응답을 불러오지 못했어요.";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message.replace(/^\[ERROR:[^\]]*\]\s*/, "");
    } catch {
      // Keep the user-facing fallback when the error response is not JSON.
    }
    throw new Error(message);
  }

  if (!response.body) throw new Error("챗봇 응답 스트림을 시작하지 못했어요.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = eventFromSseBlock(block);
      if (event) onEvent(event);
    }

    if (done) break;
  }

  const trailingEvent = eventFromSseBlock(buffer);
  if (trailingEvent) onEvent(trailingEvent);
}
