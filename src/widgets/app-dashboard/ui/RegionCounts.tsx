"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { REGIONS, REGION_LABELS, REGION_COLORS } from "@/entities/region";
import { fetchRegionCounts } from "@/entities/space/api";
import { getErrorMessage } from "@/shared/api/error";
import { TONE_DOT_BG } from "./tone-dot";

/** All region categories stay visible, including those with no registered spaces. */
export function RegionCounts() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["spaces", "counts", "by-region"],
    queryFn: fetchRegionCounts,
  });
  const counts = new Map((data ?? []).map(({ region, count }) => [region, count]));

  return (
    <section className="border-b border-line app-gutter py-8 sm:py-10">
      <div className="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 className="section-title text-ink">지역별로 보기</h2>
        <Link href="/map" className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink/75 transition-colors hover:text-ink hover:underline underline-offset-4 sm:text-base">
          지도로 보기
        </Link>
      </div>
      {isError && <p role="alert" className="mb-4 text-sm text-soft">지역별 공간 수를 불러오지 못했어요. {getErrorMessage(error)}</p>}
      <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4" aria-busy={isLoading}>
        {REGIONS.map((region) => (
          <Link key={region} href={`/search?region=${region}`} className="group flex flex-col gap-6 bg-white p-4 transition-colors hover:bg-wash">
            <span className="flex items-center gap-2">
              <i className={`block h-[9px] w-[9px] ${TONE_DOT_BG[REGION_COLORS[region]]}`} aria-hidden="true" />
              <span className="font-mono text-[0.63rem] tracking-[0.1em] text-soft">{region}</span>
            </span>
            <span className="mt-auto text-lg font-bold tracking-tight text-ink">{REGION_LABELS[region]}</span>
            <span className="font-mono text-[0.7rem] text-soft">
              {isLoading ? "불러오는 중…" : isError ? "개수 확인 중" : `${(counts.get(region) ?? 0).toLocaleString()}개 공간`}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
