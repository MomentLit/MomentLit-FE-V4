import type { ChatRoomListItem } from "@/entities/message";
import type { SpectrumTone } from "@/shared/ui";

const TONES: SpectrumTone[] = ["sky", "lime", "lemon", "coral", "rose", "violet"];

/** Deterministic color tag for a room — the backend doesn't send one, so derive it from the id. */
export function toneForRoom(room: ChatRoomListItem): SpectrumTone {
  return TONES[room.chat_room_id % TONES.length];
}

/** The other party in the room, relative to the signed-in user (who is either the host or the seller). */
export function partnerOf(room: ChatRoomListItem, currentUserId: string | undefined): { id: string; name: string } {
  if (currentUserId && room.host.id === currentUserId) return room.seller;
  return room.host;
}

const KST_TIME_ZONE = "Asia/Seoul";

/**
 * `created_at`은 오프셋 없는 LocalDateTime 문자열로 오는데, 현재 백엔드는 이미 한국 시간(KST)
 * 벽시계 값으로 내려준다(과거엔 UTC였으나 서버 타임존이 바뀜). 오프셋이 없으면 KST(+09:00)로
 * 못박아 파싱한 뒤 KST로 표시한다 — 뷰어의 브라우저 타임존과 무관하게 항상 KST.
 */
function parseTimestamp(iso: string): Date {
  const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}+09:00`);
}

/** `HH:mm` for today(KST), `MM.DD` otherwise — mirrors the old mock's time formatting. */
export function formatTimestamp(iso: string): string {
  const date = parseTimestamp(iso);
  if (Number.isNaN(date.getTime())) return "";

  const todayKst = new Intl.DateTimeFormat("en-CA", { timeZone: KST_TIME_ZONE }).format(new Date());
  const dateKst = new Intl.DateTimeFormat("en-CA", { timeZone: KST_TIME_ZONE }).format(date);

  if (dateKst === todayKst) {
    return date.toLocaleTimeString("ko-KR", { timeZone: KST_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  }

  const [, mm, dd] = dateKst.split("-");
  return `${mm}.${dd}`;
}

/** 이 간격(2시간) 이상 지난 뒤 보낸 메시지에는 시간 구분선을 다시 표시한다. */
export const TIME_DIVIDER_GAP_MS = 2 * 60 * 60 * 1000;

/**
 * 인스타그램 DM처럼: 첫 메시지이거나, 직전 메시지로부터 2시간 이상 지났을 때만 시간을 보여준다.
 * 기준은 항상 "직전 메시지의 전송 시각"이다.
 */
export function shouldShowTimeDivider(prevIso: string | undefined, currentIso: string): boolean {
  if (!prevIso) return true;
  const prev = parseTimestamp(prevIso).getTime();
  const current = parseTimestamp(currentIso).getTime();
  if (Number.isNaN(current)) return false;
  if (Number.isNaN(prev)) return true;
  return current - prev >= TIME_DIVIDER_GAP_MS;
}

/** 구분선용 시간 — 항상 KST 기준 `2026. 11. 2. 오후 6:59` 형식. */
export function formatDividerTimestamp(iso: string): string {
  const date = parseTimestamp(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR", {
    timeZone: KST_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
