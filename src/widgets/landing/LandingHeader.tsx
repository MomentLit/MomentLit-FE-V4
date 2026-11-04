"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAuthStore } from "@/entities/auth";
import { Logo } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { LandingAuthButtons, LandingLinks } from "./LandingNavItems";
import { useScrolled } from "./useScrolled";

/**
 * 랜딩 헤더 — 하나의 줄이 히어로 위에 얹혀 있다가(배경·테두리 없음), 스크롤을 시작하는
 * 순간 흰 박스로 감싸져 그대로 따라온다. 모바일은 맨 위에서만 링크 줄을 아래에 한 줄 더 보여 준다.
 */
export function LandingHeader() {
  const scrolled = useScrolled();
  const router = useRouter();

  // 헤더의 로그인 버튼으로 연 로그인(회원가입 후 자동 로그인 포함)에 성공했을 때만 홈으로 보낸다.
  // 관심(하트) 버튼 등 다른 곳에서 연 로그인은 랜딩에 그대로 남는다. 로그인 없이 창을 닫으면 표시를 지운다.
  const fromHeaderLogin = useRef(false);
  useEffect(
    () =>
      useAuthStore.subscribe((state, prev) => {
        if (prev.hydrated && !prev.isAuthenticated && state.isAuthenticated && fromHeaderLogin.current) {
          fromHeaderLogin.current = false;
          router.push("/home");
        } else if (prev.isAuthModalOpen && !state.isAuthModalOpen && !state.isAuthenticated) {
          fromHeaderLogin.current = false;
        }
      }),
    [router],
  );

  return (
    <header
      className={cn(
        "landing-top fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300",
        scrolled ? "border-line bg-white/95 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="flex h-[68px] items-center gap-7 sm:h-20">
        <Link href="/" className="inline-flex shrink-0 items-center" aria-label="모먼트릿 홈">
          <Logo size={64} className="h-12 w-12 sm:h-16 sm:w-16" />
        </Link>
        <LandingLinks className="hidden sm:flex" />
        <div className="ml-auto flex items-center gap-4">
          <Link href="/home" className="hidden whitespace-nowrap text-sm font-bold text-soft hover:text-ink md:block">
            메인으로 →
          </Link>
          <LandingAuthButtons onLoginClick={() => (fromHeaderLogin.current = true)} />
        </div>
      </div>
      {!scrolled && <LandingLinks className="-mt-2 pb-1 sm:hidden" />}
    </header>
  );
}
