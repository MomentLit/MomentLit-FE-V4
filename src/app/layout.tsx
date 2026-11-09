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
 * (롯데리아 리아체 ExtraBold — Black Han Sans 대체), `--f-en` (Archivo) and `--f-m` (DM Mono) tokens — see
 * ANALYSIS.md §2.1/§2.7/§2.8. Exposed as CSS variables (not Tailwind theme
 * tokens, since globals.css's `@theme inline` block is out of scope here)
 * and consumed directly via `style={{ fontFamily: "var(--font-*)" }}` in
 * the landing/opening-intro widgets.
 */
// 롯데리아 리아체(RiaSans) ExtraBold — https://www.lotteriafont.com/riasans
// 라이선스(fonts/RiaSans_license.pdf)상 웹 임베딩은 허용, 폰트 파일 수정·재배포는 금지라
// 공식 배포 TTF를 변환 없이 그대로 셀프 호스팅한다. 호출부가 모두 font-normal(400)로
// 쓰므로 단일 굵기를 400으로 등록해 합성 굵기 없이 ExtraBold 그대로 그려지게 한다.
const displayFont = localFont({
  src: "./fonts/RiaSans-ExtraBold.ttf",
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
