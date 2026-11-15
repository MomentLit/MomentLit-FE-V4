import type { Metadata } from "next";
import { Geist, Geist_Mono, Archivo, Black_Han_Sans, DM_Mono } from "next/font/google";
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
 * (히어로는 Black Han Sans `--font-hero`, 나머지 제목은 페이퍼로지 `--font-display` — globals.css의 @font-face), `--f-en` (Archivo) and `--f-m` (DM Mono) tokens — see
 * ANALYSIS.md §2.1/§2.7/§2.8. Exposed as CSS variables (not Tailwind theme
 * tokens, since globals.css's `@theme inline` block is out of scope here)
 * and consumed directly via `style={{ fontFamily: "var(--font-*)" }}` in
 * the landing/opening-intro widgets.
 */
// 히어로 헤드라인 전용 — Black Han Sans. Google이 "latin" subset만 등록해 두었지만
// 그 subset이 한글 전체를 담은 채(서브셋팅 없이) 내려와서 한글 제목도 그대로 그려진다.
const heroFont = Black_Han_Sans({
  variable: "--font-hero",
  weight: "400",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${heroFont.variable} ${enFont.variable} ${labelFont.variable} h-full antialiased`}
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
