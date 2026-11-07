"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconArrowRight,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogin,
  IconLogout,
  IconMenu2,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import {
  Home,
  Search,
  Calendar,
  MessageSquare,
  Store,
  Heart,
  Inbox,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib";
import { Logo, type SpectrumTone } from "@/shared/ui";
import { useAuthStore } from "@/entities/auth";
import { useUnreadDmStore, useUnreadDmWatcher } from "@/entities/message";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tone?: SpectrumTone;
}

/**
 * 메뉴 묶음. 메뉴가 적어서 묶음마다 제목을 달지 않고 얇은 선으로만 나눈다 — 제목은 권한이 다른
 * 관리자 메뉴처럼 성격이 확실히 다른 묶음에만 붙인다.
 */
interface NavGroup {
  id: string;
  label?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "explore",
    items: [
      { label: "홈", href: "/home", icon: Home },
      { label: "통합 검색", href: "/search", icon: Search, tone: "sky" },
    ],
  },
  {
    id: "booking",
    items: [
      { label: "예약", href: "/reservations", icon: Calendar, tone: "lemon" },
      { label: "메시지", href: "/messages", icon: MessageSquare, tone: "violet" },
    ],
  },
  {
    id: "activity",
    items: [
      { label: "내 공간 및 팝업", href: "/profile", icon: Store, tone: "sky" },
      { label: "관심", href: "/favorites", icon: Heart, tone: "coral" },
      { label: "건의함", href: "/suggestions", icon: Inbox, tone: "lime" },
    ],
  },
];

const ADMIN_NAV_GROUP: NavGroup = {
  id: "admin",
  label: "관리",
  items: [
    { label: "공간 승인", href: "/admin/spaces", icon: ClipboardCheck, tone: "sky" },
    { label: "건의 관리", href: "/admin/suggestions", icon: Inbox, tone: "lime" },
  ],
};

function isNavItemActive(item: NavItem, pathname: string): boolean {
  return pathname === item.href;
}

// Written out as literal class names (not built with a template string) so
// Tailwind's static scanner can see and generate them — same reasoning as
// shared/ui/Card.tsx's TONE_CLASSES.
const TONE_TEXT: Record<SpectrumTone, string> = {
  sky: "text-sky",
  lime: "text-lime",
  lemon: "text-lemon",
  coral: "text-coral",
  rose: "text-rose",
  violet: "text-violet",
};

// PC 사이드바 접힘 상태 — 페이지를 옮기거나 새로고침해도 유지되게 브라우저에 기억한다.
const COLLAPSED_KEY = "ml-sidebar-collapsed";
const COLLAPSED_EVENT = "ml-sidebar-collapsed-change";

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(COLLAPSED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(COLLAPSED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function setCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // 저장이 막혀 있어도 이번 화면에서는 접히게 이벤트만 보낸다.
  }
  window.dispatchEvent(new Event(COLLAPSED_EVENT));
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
  // PC(md 이상)에서만 쓰는 접힘 — 접으면 아이콘만 남는 64px 레일이 된다. 모바일은 기존 햄버거 그대로.
  // 폭은 애니메이션하지 않는다: width 전환은 매 프레임 본문 전체를 다시 배치·그려서 사진이 많은 화면에서 끊긴다.
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const hasUnreadDm = useUnreadDmStore((state) => state.unreadRoomIds.size > 0);
  useUnreadDmWatcher();

  const navGroups = user?.role === "ADMIN" ? [...NAV_GROUPS, ADMIN_NAV_GROUP] : NAV_GROUPS;

  return (
    <aside
      className={cn(
        "sticky top-0 z-30 flex flex-none flex-col border-b border-line bg-white md:z-auto md:h-dvh md:gap-4 md:overflow-y-auto md:overflow-x-hidden md:border-b-0 md:border-r md:py-4",
        collapsed ? "md:w-16" : "md:w-[220px]",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-4.5 py-3 md:py-0",
          collapsed && "md:flex-col md:gap-2 md:px-0",
        )}
      >
        <Link href="/" aria-label="모먼트릿 랜딩페이지" className="inline-flex items-center">
          <Logo size={48} className={cn(collapsed && "md:h-10 md:w-10")} />
        </Link>
        <div className={cn("flex items-center gap-1", collapsed && "md:flex-col")}>
          <NotificationBell />
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            className="hidden h-9 w-9 place-items-center text-soft transition-colors hover:bg-wash hover:text-ink md:grid"
          >
            {collapsed ? (
              <IconLayoutSidebarLeftExpand size={20} stroke={1.8} aria-hidden />
            ) : (
              <IconLayoutSidebarLeftCollapse size={20} stroke={1.8} aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={mobileOpen}
            className="grid h-9 w-9 place-items-center text-ink md:hidden"
          >
            {mobileOpen ? <IconX size={20} stroke={2} /> : <IconMenu2 size={20} stroke={2} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 flex-col gap-4 md:flex md:max-h-none md:overflow-visible",
          mobileOpen
            ? "flex max-h-[calc(100dvh-56px)] overflow-y-auto border-t border-line py-4"
            : "hidden",
        )}
      >
      {navGroups.map((group, groupIndex) => (
        <div key={group.id} className="flex flex-col gap-px">
          {/* 묶음 사이는 얇은 선. 제목이 있는 묶음(관리)은 펼쳤을 때 선 대신 제목을 보여 준다. */}
          {groupIndex > 0 && (
            <span aria-hidden className={cn("mx-4 mb-2 h-px bg-line", group.label && !collapsed && "hidden")} />
          )}
          {group.label && (
            <span className={cn("px-4.5 pb-1.5 pt-1 text-xs font-bold text-soft", collapsed && "md:hidden")}>
              {group.label}
            </span>
          )}
          {group.items.map((item) => {
            const isActive = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group mx-2.5 flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-bold transition-colors",
                  collapsed && "md:justify-center md:px-0",
                  isActive ? "bg-primary-100 text-ink" : "text-ink hover:bg-wash",
                )}
              >
                <span className="relative flex-none">
                  <item.icon
                    size={18}
                    strokeWidth={2}
                    className={cn(
                      "transition-transform duration-200 group-hover:scale-125",
                      isActive ? "text-sky" : item.tone ? TONE_TEXT[item.tone] : "text-soft",
                    )}
                    aria-hidden
                  />
                  {item.href === "/messages" && hasUnreadDm && (
                    <span
                      aria-hidden
                      className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-coral"
                    />
                  )}
                </span>
                <span className={cn(collapsed && "md:sr-only")}>
                  {item.label}
                  {item.href === "/messages" && hasUnreadDm && (
                    <span className="sr-only"> (읽지 않은 메시지 있음)</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-2.5 px-2.5">
        <Link
          href="/spaces/new"
          onClick={() => setMobileOpen(false)}
          aria-label="공간 등록"
          title={collapsed ? "공간 등록" : undefined}
          className={cn("button button--primary w-full", collapsed && "md:!px-0")}
        >
          <span className={cn(collapsed && "md:hidden")}>공간 등록</span>
          <IconArrowRight size={16} stroke={2} aria-hidden className={cn(collapsed && "md:hidden")} />
          {collapsed && <IconPlus size={18} stroke={2.2} aria-hidden className="hidden shrink-0 md:block" />}
        </Link>
        {isAuthenticated && user ? (
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-md border border-line p-2.5",
              collapsed && "md:flex-col md:border-0 md:p-0",
            )}
          >
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              title={collapsed ? user.name : undefined}
              className={cn("flex min-w-0 flex-1 items-center gap-2.5", collapsed && "md:flex-none")}
            >
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
              <div className={cn("flex min-w-0 flex-1 flex-col leading-tight", collapsed && "md:hidden")}>
                <b className="truncate text-sm font-bold text-ink">{user.name}</b>
                <span className="truncate text-[0.63rem] text-soft">{user.email}</span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              aria-label="로그아웃"
              title={collapsed ? "로그아웃" : undefined}
              className="flex-none text-[0.63rem] font-bold text-soft hover:text-ink"
            >
              <span className={cn(collapsed && "md:hidden")}>로그아웃</span>
              {collapsed && <IconLogout size={17} stroke={1.8} aria-hidden className="hidden md:block" />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            aria-label="로그인 / 회원가입"
            title={collapsed ? "로그인 / 회원가입" : undefined}
            className="flex items-center justify-center gap-2 rounded-md border border-line p-2.5 text-sm font-bold text-ink hover:bg-wash"
          >
            <span className={cn(collapsed && "md:hidden")}>로그인 / 회원가입</span>
            {collapsed && <IconLogin size={18} stroke={1.8} aria-hidden className="hidden md:block" />}
          </button>
        )}
      </div>
      </div>
    </aside>
  );
}
