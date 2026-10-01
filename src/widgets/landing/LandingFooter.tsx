import Link from "next/link";
import { Logo } from "@/shared/ui";

const SERVICE_LINKS = [
  { label: "공간 찾기", href: "/search" },
  { label: "팝업 검색", href: "/search?mode=popup" },
  { label: "공간 등록", href: "/spaces/new" },
];

const SUPPORT_LINKS = [
  { label: "호스트 안내", href: "/#host-guide" },
  { label: "건의함", href: "/suggestions" },
];

/** Site footer — ports `.foot` from design-reference.html (ANALYSIS.md §2.1). */
export function LandingFooter() {
  return (
    <footer className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="grid grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-3">
        <div>
          <Link href="/" className="inline-flex items-center" aria-label="모먼트릿">
            <Logo size={48} />
          </Link>
          <p className="mt-3 max-w-[28ch] text-sm leading-relaxed text-soft">공간과 브랜드의 다음 장면을 잇습니다.</p>
        </div>

        <div>
          <h4
            className="mb-3 text-lg font-bold tracking-tight text-ink"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Service
          </h4>
          <ul className="flex flex-col gap-1.5">
            {SERVICE_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-[0.85rem] text-soft hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4
            className="mb-3 text-lg font-bold tracking-tight text-ink"
            style={{ fontFamily: "var(--font-label)" }}
          >
            Support
          </h4>
          <ul className="flex flex-col gap-1.5">
            {SUPPORT_LINKS.map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="text-[0.85rem] text-soft hover:text-ink">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-4 text-[0.76rem] leading-[1.85] text-soft sm:mt-10">
        <p>
          모먼트릿은 공간 제공자와 이용자를 연결하는 플랫폼입니다. 예약 이후의 이용 조건, 결제, 환불 및 분쟁에 관한 사항은
          공간 제공자와 이용자 간의 책임입니다. 본 서비스는 학교 프로젝트로 제작되었으며 결제 기능은 지원하지 않습니다.
        </p>
        <p className="mt-2">© 2026 MomentLit</p>
      </div>
    </footer>
  );
}
