import type { ChatRoomListItem } from "@/entities/message";
import type { SpectrumTone } from "@/shared/ui";

const TONES: SpectrumTone[] = ["sky", "mint", "lime", "lemon", "apricot", "coral", "rose", "violet"];

/** Deterministic color tag for a room — the backend doesn't send one, so derive it from the id. */
export function toneForRoom(room: ChatRoomListItem): SpectrumTone {
  return TONES[room.chat_room_id % TONES.length];
}

/** The other party in the room, relative to the signed-in user (who is either the host or the seller). */
export function partnerOf(room: ChatRoomListItem, currentUserId: string | undefined): { id: string; name: string } {
  if (currentUserId && room.host.id === currentUserId) return room.seller;
  return room.host;
}

/** `HH:mm` for today, `MM.DD` otherwise — mirrors the old mock's time formatting. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${mm}.${dd}`;
}
