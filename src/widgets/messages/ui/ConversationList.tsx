import { cn } from "@/shared/lib";
import type { ChatRoomListItem } from "@/entities/message";
import type { SpectrumTone } from "@/shared/ui";
import { formatTimestamp, partnerOf, toneForRoom } from "../lib/partner";

const TONE_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky",
  lime: "bg-lime",
  lemon: "bg-lemon",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

/** 대화 목록(상대 이름/연결된 공간/생성일). Ported from design-reference `.conv`/`.crow`. */
export function ConversationList({
  rooms,
  activeId,
  currentUserId,
  onSelect,
}: {
  rooms: ChatRoomListItem[];
  activeId: number;
  currentUserId: string | undefined;
  onSelect: (id: number) => void;
}) {
  return (
    <aside className="flex min-h-0 w-full flex-col border-r border-line">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">메시지</h2>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {rooms.map((room) => {
          const partner = partnerOf(room, currentUserId);
          const isActive = room.chat_room_id === activeId;
          return (
            <button
              key={room.chat_room_id}
              type="button"
              onClick={() => onSelect(room.chat_room_id)}
              aria-current={isActive}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-wash",
                isActive && "bg-wash",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-bold text-ink",
                  TONE_BG[toneForRoom(room)],
                )}
              >
                {partner.name.slice(0, 1)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-baseline gap-2">
                  <b className="truncate text-[0.86rem] font-bold text-ink">{partner.name}</b>
                  <time className="ml-auto flex-none font-mono text-[0.64rem] text-soft">
                    {formatTimestamp(room.created_at)}
                  </time>
                </span>
                <p className="truncate text-[0.8rem] text-soft">{room.space.name}</p>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
