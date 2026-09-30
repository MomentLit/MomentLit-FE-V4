"use client";

import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { Logo } from "@/shared/ui";
import { useAuthStore } from "@/entities/auth";

/** Sticky landing nav bar — ports `.bar` from design-reference.html (ANALYSIS.md §2.1). */
export function LandingHeader() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userName = useAuthStore((state) => state.user?.name);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const signOut = useAuthStore((state) => state.signOut);

  return (
    <header className="landing-top sticky top-0 z-40 flex h-[72px] items-center gap-3 border-b border-line bg-white/95 backdrop-blur-md">
      <Link href="/" className="inline-flex shrink-0 items-center gap-2.5" aria-label="모먼트릿 홈">
        <Logo size={48} />
      </Link>

      <div className="ml-auto flex items-center gap-2">
        {isAuthenticated ? (
          <>
            <Link href="/home" className="hidden px-2 text-sm font-bold text-ink sm:block">
              <span className="hidden sm:inline">{userName}님</span>
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="button button--outline"
            >
              로그아웃
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="button button--outline"
          >
            로그인
          </button>
        )}
        <Link
          href="/spaces/new"
          className="button button--primary group"
        >
          공간 등록
          <IconArrowRight size={15} stroke={2} className="hidden sm:block transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
