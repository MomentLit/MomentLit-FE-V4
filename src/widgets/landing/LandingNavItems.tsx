"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { useAuthStore } from "@/entities/auth";
import { cn } from "@/shared/lib";

const LANDING_LINKS = [
  { label: "공간", href: "/search" },
  { label: "팝업", href: "/search?mode=popup" },
  { label: "호스트 안내", href: "/#host-guide" },
];

/** 랜딩 탐색 링크(공간 · 팝업 · 호스트 안내). 히어로 상단과 스크롤 헤더가 같이 쓴다. */
export function LandingLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="랜딩 탐색" className={cn("flex items-center gap-4 sm:gap-6", className)}>
      {LANDING_LINKS.map(({ label, href }) => (
        <Link key={label} href={href} className="group relative whitespace-nowrap py-3 text-[0.95rem] font-bold text-ink sm:text-base">
          {label}
          <span className="absolute inset-x-0 bottom-1 h-[3px] origin-left scale-x-0 bg-sky transition-transform group-hover:scale-x-100 group-focus-visible:scale-x-100" />
        </Link>
      ))}
    </nav>
  );
}

/** 로그인(로그아웃) · 공간 등록 버튼. 히어로 상단과 스크롤 헤더가 같이 쓴다. */
export function LandingAuthButtons({ className }: { className?: string }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userName = useAuthStore((state) => state.user?.name);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isAuthenticated ? (
        <>
          <Link href="/home" className="hidden px-2 text-sm font-bold text-ink sm:block">
            {userName}님
          </Link>
          <button type="button" onClick={() => signOut()} className="button button--outline">
            로그아웃
          </button>
        </>
      ) : (
        <button type="button" onClick={openAuthModal} className="button button--outline">
          로그인
        </button>
      )}
      <Link href="/spaces/new" className="button button--primary group">
        공간 등록
        <IconArrowRight
          size={15}
          stroke={2}
          className="hidden transition-transform duration-200 group-hover:translate-x-1 sm:block"
          aria-hidden
        />
      </Link>
    </div>
  );
}
