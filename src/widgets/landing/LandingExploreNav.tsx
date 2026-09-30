import Link from "next/link";

export function LandingExploreNav() {
  return (
    <nav aria-label="랜딩 탐색" className="landing-explore sticky top-[72px] z-30 flex h-12 items-center gap-6 border-b border-line bg-white/95 backdrop-blur-md">
      {[{ label: "공간", href: "/search" }, { label: "팝업", href: "/search?mode=popup" }, { label: "호스트 안내", href: "/#host-guide" }].map(({ label, href }) => (
        <Link key={label} href={href} className="group relative py-3 text-sm font-bold text-ink">
          {label}<span className="absolute inset-x-0 bottom-1 h-[3px] origin-left scale-x-0 bg-sky transition-transform group-hover:scale-x-100 group-focus-visible:scale-x-100" />
        </Link>
      ))}
      <Link href="/home" className="ml-auto text-xs font-bold text-soft hover:text-ink">메인으로 →</Link>
    </nav>
  );
}
