import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo, DM_Mono } from "next/font/google";
import localFont from "next/font/local";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/shared/config";
import { OpeningIntro } from "@/widgets/opening-intro/OpeningIntro";
import { AuthModal } from "@/widgets/auth";
import { Providers } from "./providers";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 * Display/label/wordmark faces from docs/design-reference.html's `--f-d`
 * (롯데리아 촵땡겨체 — Black Han Sans 대체), `--f-en` (Archivo) and `--f-m` (DM Mono) tokens — see
 * ANALYSIS.md §2.1/§2.7/§2.8. Exposed as CSS variables (not Tailwind theme
 * tokens, since globals.css's `@theme inline` block is out of scope here)
 * and consumed directly via `style={{ fontFamily: "var(--font-*)" }}` in
 * the landing/opening-intro widgets.
 */
// 롯데리아 촵땡겨체 — 한글 전체가 들어 있는 단일 굵기 디스플레이 폰트라 로컬로 묶어 셀프 호스팅한다.
const displayFont = localFont({
  src: "./fonts/LotteriaChab.woff2",
  variable: "--font-display",
  weight: "400",
  display: "swap",
});

const enFont = Archivo({
  variable: "--font-en",
  weight: ["800", "900"],
  subsets: ["latin"],
});

const labelFont = DM_Mono({
  variable: "--font-label",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | 공간·팝업스토어 대여 매칭 플랫폼`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: ["모먼트릿", "공간 대여", "팝업스토어", "공간 예약", "팝업 매칭"],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${displayFont.variable} ${enFont.variable} ${labelFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-wash text-ink">
        <Providers>
          <OpeningIntro />
          {children}
          <AuthModal />
        </Providers>
      </body>
    </html>
  );
}
