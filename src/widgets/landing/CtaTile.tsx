import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import { cn } from "@/shared/lib";

const TONE_BG = { lemon: "bg-lemon", sky: "bg-sky" } as const;

/**
 * 랜딩 그리드 끝에 붙는 등록 유도 타일 — 공간 섹션은 노란(lemon) "공간 등록하기",
 * 팝업 섹션은 하늘색(sky) "팝업 등록하기"로 같은 모양을 공유한다.
 */
export function CtaTile({
  href,
  tone,
  title,
  cta,
  className,
}: {
  href: string;
  tone: keyof typeof TONE_BG;
  title: [string, string];
  cta: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-[300px] flex-col justify-between gap-6 overflow-hidden p-6 text-ink transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[0_0_0_1.5px_var(--ink),8px_8px_0_var(--ink)]",
        TONE_BG[tone],
        className,
      )}
    >
      <b className="text-[clamp(1.6rem,2.2vw,2.1rem)] font-normal leading-[1.15] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
        {title[0]}
        <br />
        {title[1]}
      </b>
      <span className="inline-flex items-center gap-1.5 self-start px-px text-sm font-bold shadow-[inset_0_-0.32em_0_white]">
        {cta}
        <IconArrowRight size={15} stroke={2.2} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
