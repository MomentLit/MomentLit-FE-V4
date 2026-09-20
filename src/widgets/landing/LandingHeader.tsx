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
    <header className="sticky top-0 z-40 flex items-center gap-6 border-b border-line bg-white/95 px-4 py-3.5 backdrop-blur-md sm:px-6">
      <Link href="/" className="inline-flex items-center gap-2.5" aria-label="모먼트릿 홈">
        <Logo size={48} />
      </Link>

      <nav className="mx-auto hidden gap-1 md:flex">
        {[
          { label: "공간", href: "/search" },
          { label: "팝업", href: "/home" },
          { label: "호스트", href: "/spaces/new" },
        ].map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            className="group relative px-3.5 py-2 text-sm font-bold text-ink"
          >
            {label}
            <span className="absolute inset-x-3.5 bottom-0.5 h-[3px] origin-left scale-x-0 bg-sky transition-transform duration-200 group-hover:scale-x-100" />
          </Link>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2 md:ml-0">
        {isAuthenticated ? (
          <>
            <Link href="/home" className="px-2 text-[0.83rem] font-bold text-ink">
              {userName}님
            </Link>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center rounded-none px-4 py-2.5 text-[0.83rem] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--line-2)] transition-colors hover:bg-ink hover:text-white hover:shadow-[inset_0_0_0_1.5px_var(--ink)]"
            >
              로그아웃
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={openAuthModal}
            className="inline-flex items-center rounded-none px-4 py-2.5 text-[0.83rem] font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--line-2)] transition-colors hover:bg-ink hover:text-white hover:shadow-[inset_0_0_0_1.5px_var(--ink)]"
          >
            로그인
          </button>
        )}
        <Link
          href="/spaces/new"
          className="group inline-flex items-center gap-2 bg-sky px-4 py-2.5 text-[0.83rem] font-bold text-ink transition-colors hover:bg-main-d hover:text-white"
        >
          공간 등록
          <IconArrowRight size={15} stroke={2} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
        </Link>
      </div>
    </header>
  );
}
