"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";
import { SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { Dropdown } from "@/shared/ui";
import { TrailLayer } from "./TrailLayer";
import { CATEGORY_DISPLAY_ORDER } from "./layoutConfig";

// The hero's category select mirrors design-reference.html's `.ask` combo,
// which lists 9 of the 10 categories (no "기타") in mosaic order.
const HERO_CATEGORIES = CATEGORY_DISPLAY_ORDER.filter((category) => category !== "OTHER");

function pickStyle(color: string): CSSProperties {
  return { "--pc": color } as CSSProperties;
}

/** Landing hero — headline, sub copy, and the region/category/date combo search. Ports `.lhero` (ANALYSIS.md §2.1). */
export function LandingHero() {
  const router = useRouter();
  const [region, setRegion] = useState<Region | "">("");
  const [category, setCategory] = useState<SpaceCategory | "">("");
  const [date, setDate] = useState("");

  function handleSearch() {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (category) params.set("category", category);
    if (date) params.set("date", date);
    router.push(params.size > 0 ? `/search?${params.toString()}` : "/search");
  }

  return (
    <section className="relative border-b border-line px-4 py-12 sm:px-6 sm:py-16 lg:py-24">
      <TrailLayer />

      <div className="relative z-[2]">
        <h1
          className="text-[clamp(2.6rem,8vw,6.4rem)] font-normal leading-[1.02] tracking-tight text-ink"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <span className="text-sky">공간</span>과{" "}
          <span className="relative inline-block px-[0.06em]">
            <span className="absolute inset-x-0 -z-10 top-[0.17em] bottom-[0.13em] bg-lemon" />
            브랜드
          </span>
          를<br />
          잇다<span className="text-coral">.</span>
        </h1>

        <p className="mt-5 max-w-[42ch] text-base leading-[1.85] text-soft sm:mt-6">
          쓰지 않는 시간대만 골라 내놓고, 필요한 날짜만큼만 빌립니다. 팝업스토어·스튜디오·카페·홀을 중개인 없이 직접 연결합니다.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4 sm:mt-10 sm:gap-6">
          <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[clamp(1.05rem,2vw,1.5rem)] font-bold tracking-tight text-ink">
            <Dropdown
              value={region}
              onChange={setRegion}
              options={REGIONS.map((option) => ({ value: option, label: REGION_LABELS[option] }))}
              placeholder="전체 지역"
              ariaLabel="지역"
              accent="var(--sky)"
            />
            <span className="font-normal text-soft">에서</span>
            <Dropdown
              value={category}
              onChange={setCategory}
              options={HERO_CATEGORIES.map((option) => ({ value: option, label: SPACE_CATEGORY_LABELS[option] }))}
              placeholder="전체 카테고리"
              ariaLabel="카테고리"
              accent="var(--coral)"
            />
            <span className="font-normal text-soft">를</span>
            <input
              type="date"
              className="ml-pick"
              style={pickStyle("var(--lemon)")}
              aria-label="날짜"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
            <span className="font-normal text-soft">에</span>
          </p>
          <button
            type="button"
            onClick={handleSearch}
            className="group inline-flex items-center gap-2.5 bg-sky px-6 py-3.5 text-[0.93rem] font-bold text-ink transition-colors hover:bg-main-d hover:text-white"
          >
            찾아보기
            <IconArrowRight size={17} stroke={2} className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
          </button>
        </div>
      </div>

      <style>{`
        .ml-pick{
          appearance:none;-webkit-appearance:none;border:0;border-radius:0;background:transparent;
          font:inherit;font-weight:700;color:var(--ink);cursor:pointer;padding:1px 3px 3px;
          box-shadow:inset 0 -0.28em 0 var(--pc);
          transition:box-shadow .26s cubic-bezier(.2,.85,.25,1),color .2s;
        }
        .ml-pick:hover,.ml-pick:focus{box-shadow:inset 0 -1.35em 0 var(--pc);color:var(--ink)}
      `}</style>
    </section>
  );
}
