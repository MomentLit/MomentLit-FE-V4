"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";
import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { SPACE_CATEGORY_DISPLAY_ORDER, SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import { TrailLayer } from "@/widgets/landing/TrailLayer";
import { Dropdown, DatePicker } from "@/shared/ui";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Top combo search — region/category/date, wired to `/search`'s real filters
 * (`region`/`category`/`date` query params, read by `SearchPageContent` on
 * mount). "전체"(빈 값)는 그 축을 필터링하지 않는다는 뜻.
 */
export function ComboSearch() {
  const router = useRouter();
  const [region, setRegion] = useState<Region | "">("");
  const [category, setCategory] = useState<SpaceCategory | "">("");
  const [date, setDate] = useState(todayISO);

  function handleSubmit() {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (category) params.set("category", category);
    if (date) params.set("date", date);
    router.push(params.size > 0 ? `/search?${params.toString()}` : "/search");
  }

  return (
    <section aria-label="공간 검색" className="search-hero search-hero--dashboard relative isolate z-10 border-b border-line app-gutter">
      <TrailLayer />
      <div className="search-hero-content relative z-[2]">
        <h1
          style={{ fontFamily: "var(--font-display)" }}
          className="search-hero-headline text-[clamp(2.1rem,4.5vw,4rem)] font-normal leading-[1.05] tracking-tight text-ink"
        >
          <span className="relative inline-block px-[0.06em]">
            <span className="absolute inset-x-0 -z-10 top-[0.17em] bottom-[0.13em] bg-sky" />
            공간
          </span>과{" "}
          <span className="relative inline-block px-[0.06em]">
            <span className="absolute inset-x-0 -z-10 top-[0.17em] bottom-[0.13em] bg-lemon" />
            브랜드
          </span>
          를 잇다<span className="text-coral">.</span>
        </h1>

        <div className="search-hero-form">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[clamp(1.05rem,2vw,1.5rem)] font-bold tracking-tight">
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
              options={SPACE_CATEGORY_DISPLAY_ORDER.map((option) => ({ value: option, label: SPACE_CATEGORY_LABELS[option] }))}
              placeholder="전체 카테고리"
              ariaLabel="카테고리"
              accent="var(--coral)"
            />
            <span className="font-normal text-soft">를</span>
            <DatePicker
              value={date}
              onChange={setDate}
              placeholder="날짜 미정"
              ariaLabel="날짜"
              min={todayISO()}
              accent="var(--lemon)"
            />
            <span className="font-normal text-soft">에</span>
          </span>

          <button
            type="button"
            onClick={handleSubmit}
            className="button button--primary group"
          >
            검색하기
            <IconArrowRight size={16} stroke={2} className="transition-transform group-hover:translate-x-1" aria-hidden />
          </button>
        </div>
      </div>
    </section>
  );
}
