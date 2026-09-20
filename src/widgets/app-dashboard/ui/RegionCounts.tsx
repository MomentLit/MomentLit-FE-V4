"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { REGION_LABELS, REGION_COLORS, type Region } from "@/entities/region";
import { fetchRegionCounts } from "@/entities/space/api";
import { getErrorMessage } from "@/shared/api/error";
import { TONE_DOT_BG } from "./tone-dot";

function isKnownRegion(value: string): value is Region {
  return value in REGION_LABELS;
}

/** "지역별로 보기" — real `GET /spaces/counts/by-region`, one tile per region that has active spaces. */
export function RegionCounts() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["spaces", "counts", "by-region"],
    queryFn: fetchRegionCounts,
  });

  const regions = data ?? [];

  return (
    <section className="border-b border-line px-7 py-6">
      <div className="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 className="text-xl font-bold tracking-tight text-ink">지역별로 보기</h2>
        <Link
          href="/search"
          className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-soft hover:text-ink"
        >
          지도로 보기
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] animate-pulse bg-white" />
          ))}
        </div>
      ) : isError ? (
        <p className="py-6 text-sm text-soft">지역 정보를 불러오지 못했어요. {getErrorMessage(error)}</p>
      ) : regions.length === 0 ? (
        <p className="py-6 text-sm text-soft">아직 지역별로 등록된 공간이 없어요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {regions.map(({ region, count }) => {
            const known = isKnownRegion(region);
            return (
              <Link
                key={region}
                href={known ? `/search?region=${region}` : "/search"}
                className="group flex flex-col gap-6 bg-white p-4 transition-colors hover:bg-wash"
              >
                <span className="flex items-center gap-2">
                  <i
                    className={`block h-[9px] w-[9px] ${known ? TONE_DOT_BG[REGION_COLORS[region]] : "bg-line-2"}`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[0.63rem] tracking-[0.1em] text-soft">{region}</span>
                </span>
                <span className="mt-auto text-lg font-bold tracking-tight text-ink">
                  {known ? REGION_LABELS[region] : region}
                </span>
                <span className="font-mono text-[0.7rem] text-soft">{count}개 공간</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
