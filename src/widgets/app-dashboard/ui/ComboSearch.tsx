"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { IconArrowRight } from "@tabler/icons-react";
import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { SPACE_CATEGORIES, SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import { fetchCategoryCounts } from "@/entities/space/api";
import { Dropdown } from "@/shared/ui";

const selectClass =
  "cursor-pointer appearance-none rounded-none bg-transparent px-1 py-0.5 font-bold text-ink outline-none transition-shadow";

/**
 * Top combo search — region/category/date, wired to `/search`'s real filters
 * (`region`/`category`/`date` query params, read by `SearchPageContent` on
 * mount). "전체"(빈 값)는 그 축을 필터링하지 않는다는 뜻.
 */
export function ComboSearch() {
  const router = useRouter();
  const [region, setRegion] = useState<Region | "">("");
  const [category, setCategory] = useState<SpaceCategory | "">("");
  const [date, setDate] = useState("");

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
    <div className="border-b border-line px-7 py-8">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
        오늘 열린 공간 <em className="font-bold not-italic text-main-d">{totalSpaceCount.toLocaleString()}</em>
      </h1>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <span className="flex flex-wrap items-center gap-2 text-lg font-bold tracking-tight sm:text-2xl">
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
            options={SPACE_CATEGORIES.map((option) => ({ value: option, label: SPACE_CATEGORY_LABELS[option] }))}
            placeholder="전체 카테고리"
            ariaLabel="카테고리"
            accent="var(--coral)"
          />
          <span className="font-normal text-soft">를</span>
          <input
            type="date"
            aria-label="날짜"
            value={date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDate(e.target.value)}
            className={`${selectClass} shadow-[inset_0_-0.28em_0_var(--lemon)] hover:shadow-[inset_0_-1.35em_0_var(--lemon)] focus:shadow-[inset_0_-1.35em_0_var(--lemon)]`}
          />
          <span className="font-normal text-soft">에</span>
        </span>

        <button
          type="button"
          onClick={handleSubmit}
          className="group inline-flex items-center gap-2 rounded-md bg-sky px-6 py-3.5 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white"
        >
          찾아보기
          <IconArrowRight size={16} stroke={2} className="transition-transform group-hover:translate-x-1" aria-hidden />
        </button>
      </div>
    </div>
  );
}
