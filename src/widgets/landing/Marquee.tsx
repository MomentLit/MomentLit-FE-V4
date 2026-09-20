const MARQUEE_ITEMS = [
  { en: "VALUABLE SPACE & MOMENT" },
  { kr: "공간과 브랜드를 잇다" },
  { en: "POPUP · STUDIO · CAFE · HALL" },
  { kr: "중개 수수료 0원" },
];

/** Infinite-scroll ticker banner — ports `.marq` from design-reference.html (ANALYSIS.md §2.1). */
export function Marquee() {
  return (
    <div className="overflow-hidden bg-ink py-2.5 text-white">
      <div className="ml-marq-track flex w-max">
        {[0, 1].map((copy) => (
          <p key={copy} className="flex items-center gap-[18px] whitespace-nowrap pr-[18px]">
            {MARQUEE_ITEMS.map((item, i) => (
              <span key={i} className="flex items-center gap-[18px]">
                {"en" in item ? (
                  <span
                    className="text-[0.72rem] font-extrabold tracking-[0.1em]"
                    style={{ fontFamily: "var(--font-en)" }}
                  >
                    {item.en}
                  </span>
                ) : (
                  <span className="text-[0.88rem]" style={{ fontFamily: "var(--font-display)" }}>
                    {item.kr}
                  </span>
                )}
                <em className="text-sky not-italic">✳</em>
              </span>
            ))}
          </p>
        ))}
      </div>

      <style>{`
        .ml-marq-track{ animation: mlMarqueeSlide 44s linear infinite; }
        .ml-marq-track:hover{ animation-play-state: paused; }
        @keyframes mlMarqueeSlide{ from{ transform: translateX(0); } to{ transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce){ .ml-marq-track{ animation: none; } }
      `}</style>
    </div>
  );
}
