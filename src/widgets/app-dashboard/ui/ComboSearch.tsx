"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconArrowRight } from "@tabler/icons-react";
import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { SPACE_CATEGORY_DISPLAY_ORDER, SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import { fetchCategoryCounts } from "@/entities/space/api";
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

  const { data: categoryCounts } = useQuery({
    queryKey: ["spaces", "counts", "by-category"],
    queryFn: fetchCategoryCounts,
  });
  const totalSpaceCount = categoryCounts?.reduce((sum, entry) => sum + entry.count, 0) ?? 0;

  function handleSubmit() {
    const params = new URLSearchParams();
    if (region) params.set("region", region);
    if (category) params.set("category", category);
    if (date) params.set("date", date);
    router.push(params.size > 0 ? `/search?${params.toString()}` : "/search");
  }

  return (
    <section aria-label="공간 검색" className="search-hero search-hero--dashboard relative isolate border-b border-line app-gutter">
      <TrailLayer />
      <div className="search-hero-content relative z-[2]">
        <h1 style={{ fontFamily: "var(--font-display)" }} className="search-hero-headline text-[clamp(2.1rem,4.5vw,4rem)] leading-tight tracking-tight text-ink">
          <span className="underline decoration-sky decoration-4 underline-offset-8">다음 장면이 될 공간</span>
        </h1>

        <p className="search-hero-description text-soft">등록된 공간 {totalSpaceCount.toLocaleString()}곳에서 당신의 아이디어를 시작하세요.</p>
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
