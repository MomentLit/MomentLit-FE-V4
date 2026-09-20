import { cn } from "@/shared/lib";
import type { ChatRoomListItem } from "@/entities/message";
import type { SpectrumTone } from "@/shared/ui";
import { formatTimestamp, partnerOf, toneForRoom } from "../lib/partner";

const TONE_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky",
  mint: "bg-mint",
  lime: "bg-lime",
  lemon: "bg-lemon",
  apricot: "bg-apricot",
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
    <aside className="flex w-[290px] flex-none flex-col border-r border-line">
      <div className="border-b border-line px-4 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-ink">메세지</h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        {rooms.map((room) => {
          const partner = partnerOf(room, currentUserId);
          return (
            <button
              key={room.chat_room_id}
              type="button"
              onClick={() => onSelect(room.chat_room_id)}
              aria-current={room.chat_room_id === activeId}
              className={cn(
                "flex w-full items-start gap-2.5 border-b border-line px-4 py-3.5 text-left transition-colors hover:bg-wash",
                room.chat_room_id === activeId && "bg-wash shadow-[inset_3px_0_0_var(--color-ink)]",
              )}
            >
              <i aria-hidden className={cn("h-[34px] w-[34px] flex-none", TONE_BG[toneForRoom(room)])} />
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
