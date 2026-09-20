"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { IconBell } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth";
import { fetchAlarms, markAlarmRead } from "@/entities/alarm";

/**
 * 알림 벨 — 예약 요청 생성/승인/거절/취소 시 백엔드가 자동 생성하는 알람(`GET /alarm`)을
 * 보여준다. 디자인 레퍼런스에는 없던 화면이라 사이드바 로고 옆에 최소한의 형태로 얹었다.
 * 실시간 푸시는 없어서 30초 폴링으로 대체 — 채팅처럼 별도 웹소켓 채널을 새로 파는 것은
 * 이 기능 규모에 비해 과함.
 *
 * 드롭다운은 `document.body`에 포탈로 띄운다 — 사이드바(`<aside>`)가 네비게이션 스크롤을
 * 위해 `overflow-y-auto`를 쓰는데, 이 컴포넌트가 사이드바 안에 있으니 드롭다운을 그
 * 안에서 `absolute`로 띄우면 사이드바 너비(226px)를 넘어가는 280px 폭이 그대로 잘려
 * 보인다. 포탈로 빼서 `fixed` 좌표로 위치를 계산하면 어떤 조상의 overflow에도 안 잘린다.
 */
export function NotificationBell() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const alarmsQuery = useQuery({
    queryKey: ["alarms"],
    queryFn: fetchAlarms,
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markAlarmRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alarms"] }),
  });

  function toggleOpen() {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({ top: rect.bottom + 8, left: rect.left });
    }
    setIsOpen((prev) => !prev);
  }

  /** 알림 클릭 시 읽음 처리와 동시에 관련 예약함으로 이동 — 매칭 단건 상세 화면은 없어서 목록으로 보낸다. */
  function handleAlarmClick(alarm: { id: number; isRead: boolean }) {
    if (!alarm.isRead) markReadMutation.mutate(alarm.id);
    setIsOpen(false);
    router.push("/reservations");
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedButton = buttonRef.current?.contains(target);
      const clickedDropdown = dropdownRef.current?.contains(target);
      if (!clickedButton && !clickedDropdown) setIsOpen(false);
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  if (!isAuthenticated) return null;

  const alarms = alarmsQuery.data ?? [];
  const unreadCount = alarms.filter((alarm) => !alarm.isRead).length;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        aria-label="알림"
        className="relative grid h-9 w-9 place-items-center text-ink hover:bg-wash"
      >
        <IconBell size={20} stroke={1.75} aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center bg-coral px-1 text-[0.6rem] font-bold text-ink">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        dropdownPosition &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
            className="fixed z-[300] w-[280px] border border-line bg-white shadow-lg"
          >
            <div className="border-b border-line px-3.5 py-2.5 text-sm font-bold text-ink">알림</div>
            <div className="max-h-[320px] overflow-y-auto">
              {alarmsQuery.isPending ? (
                <p className="p-4 text-sm text-soft">불러오는 중…</p>
              ) : alarms.length === 0 ? (
                <p className="p-4 text-sm text-soft">알림이 없어요.</p>
              ) : (
                alarms.map((alarm) => (
                  <button
                    key={alarm.id}
                    type="button"
                    onClick={() => handleAlarmClick(alarm)}
                    className="flex w-full items-start gap-2 border-b border-line px-3.5 py-2.5 text-left last:border-b-0 hover:bg-wash"
                  >
                    <span
                      aria-hidden
                      className={`mt-1 h-1.5 w-1.5 flex-none ${alarm.isRead ? "bg-line-2" : "bg-sky"}`}
                    />
                    <span className={`text-[0.82rem] leading-snug ${alarm.isRead ? "text-soft" : "text-ink"}`}>
                      {alarm.description}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
