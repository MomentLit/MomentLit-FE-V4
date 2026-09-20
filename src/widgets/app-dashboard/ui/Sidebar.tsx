"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArrowRight, IconMenu2, IconX } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { Logo, type SpectrumTone } from "@/shared/ui";
import { useAuthStore } from "@/entities/auth";
import { NotificationBell } from "./NotificationBell";
import { TONE_DOT_BG } from "./tone-dot";

interface NavItem {
  label: string;
  href: string;
  tone?: SpectrumTone;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "탐색",
    items: [
      { label: "홈", href: "/home" },
      { label: "통합 검색", href: "/search", tone: "sky" },
    ],
  },
  {
    label: "예약 · 소통",
    items: [
      { label: "예약", href: "/reservations", tone: "lemon" },
      { label: "메세지", href: "/messages", tone: "violet" },
    ],
  },
  {
    label: "내 활동",
    items: [
      { label: "내 공간", href: "/profile", tone: "sky" },
      { label: "관심 공간", href: "/favorites", tone: "coral" },
      { label: "건의함", href: "/suggestions", tone: "mint" },
    ],
  },
];

const ADMIN_NAV_GROUP: NavGroup = {
  label: "관리",
  items: [
    { label: "공간 승인", href: "/admin/spaces", tone: "sky" },
    { label: "건의 관리", href: "/admin/suggestions", tone: "mint" },
  ],
};

function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href;
}

/**
 * Logged-in app shell sidebar — logo, nav (with color dots), register CTA, mini profile.
 * 모바일(< sm)에서는 h-dvh 고정폭 컬럼 대신 얇은 상단 바 + 햄버거로 펼치는 드롭다운 패널로
 * 바뀐다 — 이전엔 항상 h-dvh였어서 모바일 화면을 사이드바가 통째로 차지해 버렸다.
 */
export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const signOut = useAuthStore((state) => state.signOut);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navGroups = user?.role === "ADMIN" ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS;

  return (
    <aside className="sticky top-0 z-30 flex flex-none flex-col border-b border-line bg-white sm:z-auto sm:h-dvh sm:w-[226px] sm:gap-4 sm:overflow-y-auto sm:border-b-0 sm:border-r sm:py-4">
      <div className="flex items-center justify-between px-4.5 py-3 sm:py-0">
        <Link href="/home" aria-label="모먼트릿 홈" className="inline-flex items-center">
          <Logo size={27} />
        </Link>
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            className="grid h-9 w-9 place-items-center text-ink sm:hidden"
          >
            {mobileOpen ? <IconX size={20} stroke={2} /> : <IconMenu2 size={20} stroke={2} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "flex-col gap-4 sm:flex sm:max-h-none sm:overflow-visible",
          mobileOpen
            ? "flex max-h-[calc(100dvh-56px)] overflow-y-auto border-t border-line py-4"
            : "hidden",
        )}
      >
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-px">
          <span className="px-4.5 pb-1.5 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
            {group.label}
          </span>
          {group.items.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "mx-2.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-bold transition-colors",
                  isActive ? "bg-primary-100 text-ink" : "text-ink hover:bg-wash",
                )}
              >
                <i
                  className={cn(
                    "h-[9px] w-[9px] flex-none",
                    isActive ? "bg-sky" : item.tone ? TONE_DOT_BG[item.tone] : "bg-line-2",
                  )}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-2.5 px-2.5">
        <Link
          href="/spaces/new"
          onClick={() => setMobileOpen(false)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white"
        >
          공간 등록
          <IconArrowRight size={16} stroke={2} aria-hidden />
        </Link>
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2.5 rounded-md border border-line p-2.5">
            <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex min-w-0 flex-1 items-center gap-2.5">
              {user.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL
                <img src={user.imageUrl} alt={user.name} className="h-[33px] w-[33px] flex-none rounded-md object-cover" />
              ) : (
                <div
                  className="grid h-[33px] w-[33px] flex-none place-items-center rounded-md bg-sky text-sm font-bold text-ink"
                  aria-hidden="true"
                >
                  {user.name.slice(0, 1)}
                </div>
              )}
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <b className="truncate text-sm font-bold text-ink">{user.name}</b>
                <span className="truncate text-[0.63rem] text-soft">{user.email}</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="flex-none text-[0.63rem] font-bold text-soft hover:text-ink"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="flex items-center justify-center gap-2 rounded-md border border-line p-2.5 text-sm font-bold text-ink hover:bg-wash"
          >
            로그인 / 회원가입
          </button>
        )}
      </div>
      </div>
    </aside>
  );
}
