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
 * 백엔드 서버가 UTC로 떠 있어서 `created_at`(오프셋 없는 LocalDateTime 문자열)이
 * 이미 UTC 벽시계 값으로 찍혀 온다 — 오프셋을 안 붙이면 브라우저가 "자기 타임존의
 * 현재 시각"으로 잘못 해석해버리므로, 항상 UTC로 못박아 파싱한 뒤 한국 시간(KST,
 * UTC+9)으로 명시 변환해서 보여준다. 뷰어의 브라우저 타임존과 무관하게 항상 KST.
 */
function parseAsUtc(iso: string): Date {
  const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasOffset ? iso : `${iso}Z`);
}

/** `HH:mm` for today(KST), `MM.DD` otherwise — mirrors the old mock's time formatting. */
export function formatTimestamp(iso: string): string {
  const date = parseAsUtc(iso);
  if (Number.isNaN(date.getTime())) return "";

  const todayKst = new Intl.DateTimeFormat("en-CA", { timeZone: KST_TIME_ZONE }).format(new Date());
  const dateKst = new Intl.DateTimeFormat("en-CA", { timeZone: KST_TIME_ZONE }).format(date);

  if (dateKst === todayKst) {
    return date.toLocaleTimeString("ko-KR", { timeZone: KST_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  }

  const [, mm, dd] = dateKst.split("-");
  return `${mm}.${dd}`;
}
