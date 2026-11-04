"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { IconArrowRight } from "@tabler/icons-react";
import { groupSpaceOptions } from "@/entities/space";
import { fetchAvailability, fetchBookedDates, searchSpaces } from "@/entities/space/api";
import { SPACE_CATEGORY_LABELS, type SpaceCategory } from "@/entities/space-category";
import { collectPages } from "@/shared/api/pagination";
import { cn } from "@/shared/lib";
import { Reveal } from "../Reveal";
import { CATEGORY_DISPLAY_ORDER } from "../layoutConfig";
import { SpacePreviewModal } from "./SpacePreviewModal";
import { SpotlightCard, type SpotlightSpace } from "./SpotlightCard";
import { hasOpenSchedule, todayStatus } from "./today";

/** 4칸 그리드에서 큰 카드(2×2) + 작은 카드 + 등록 타일이 줄을 딱 맞게 채우는 최대 개수. */
const MAX_CARDS = 8;

/**
 * 랜딩 "지금 바로 요청할 수 있는 공간" — 호스트가 운영 시간을 열어 둔 공간만 모아 카테고리 칩으로
 * 거르고, 첫 공간을 크게 둔 벤토 그리드로 보여 준다. 맨 끝은 공간 등록 타일.
 */
export function SpaceSpotlight() {
  const [category, setCategory] = useState<SpaceCategory | null>(null);
  const [preview, setPreview] = useState<SpotlightSpace | null>(null);

  const spacesQuery = useQuery({
    queryKey: ["spaces", "landing-spotlight"],
    queryFn: ({ signal }) => collectPages((page) => searchSpaces({ page, size: 100 }, signal)),
    select: groupSpaceOptions,
    staleTime: 30_000,
  });
  const spaces = spacesQuery.data ?? [];

  // 상세 페이지와 같은 캐시 키 — 운영 시간 · 예약 마감일.
  const availability = useQueries({
    queries: spaces.map((space) => ({
      queryKey: ["space-availability", space.space_id],
      queryFn: () => fetchAvailability(space.space_id),
      staleTime: 60_000,
    })),
  });
  const booked = useQueries({
    queries: spaces.map((space) => ({
      queryKey: ["space-booked-dates", space.space_id],
      queryFn: () => fetchBookedDates(space.space_id),
      staleTime: 60_000,
    })),
  });

  const scheduleLoading = availability.some((query) => query.isPending);
  const entries = spaces
    .map((space, i) => {
      const slots = availability[i]?.data;
      const dates = booked[i]?.data;
      return {
        space,
        open: slots ? hasOpenSchedule(slots) : false,
        today: slots && dates ? todayStatus(slots, dates) : undefined,
      };
    })
    .filter((entry) => entry.open);

  const counts = new Map<SpaceCategory, number>();
  for (const { space } of entries) counts.set(space.category, (counts.get(space.category) ?? 0) + 1);

  const filtered = entries.filter((entry) => !category || entry.space.category === category);
  // 사진이 있는 공간을 앞에 둬서 큰 카드가 비어 보이지 않게 한다(나머지는 서버 순서 유지).
  const ordered = [...filtered].sort((a, b) => Number(Boolean(b.space.thumbnail_url)) - Number(Boolean(a.space.thumbnail_url))).slice(0, MAX_CARDS);
  const todayById = new Map(entries.map((entry) => [entry.space.space_id, entry.today]));
  const loading = spacesQuery.isPending || (spaces.length > 0 && scheduleLoading);

  return (
    <section aria-labelledby="spotlight-title" className="border-b border-line px-4 py-11 sm:px-6 sm:py-16 lg:py-20">
      <Reveal className="mb-7 grid items-end gap-x-10 gap-y-4 sm:mb-10 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex min-w-0 flex-col gap-4">
          <h2
            id="spotlight-title"
            className="text-[clamp(1.9rem,4.2vw,3.4rem)] leading-[1.12] tracking-tight text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            지금 바로{" "}
            <span className="relative inline-block px-[0.06em]">
              <span className="absolute inset-x-0 -z-10 top-[0.17em] bottom-[0.13em] bg-sky" />
              요청할 수 있는
            </span>{" "}
            공간
          </h2>
        </div>
        <Link
          href="/search"
          className="group inline-flex items-center gap-1.5 justify-self-start whitespace-nowrap px-px py-0.5 text-sm font-bold text-ink shadow-[inset_0_-0.32em_0_var(--lemon)] lg:justify-self-end"
        >
          공간 전체 보기
          <IconArrowRight size={15} stroke={2.2} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </Reveal>

      <div role="group" aria-label="카테고리" className="mb-8 flex flex-wrap gap-1.5">
        <Chip label="전체" count={entries.length} active={category === null} onClick={() => setCategory(null)} />
        {CATEGORY_DISPLAY_ORDER.map((item) => (
          <Chip
            key={item}
            label={SPACE_CATEGORY_LABELS[item]}
            count={counts.get(item) ?? 0}
            active={category === item}
            onClick={() => setCategory(item)}
          />
        ))}
      </div>

      {spacesQuery.isError ? (
        <p className="py-6 text-sm text-soft">공간을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>
      ) : (
        <div className="grid grid-cols-1 gap-x-[clamp(18px,2.2vw,30px)] gap-y-[clamp(36px,4vw,52px)] sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[4/3] animate-pulse bg-wash" />)
            : ordered.length > 0
              ? ordered.map(({ space }, i) => (
                  <SpotlightCard
                    key={space.space_id}
                    space={space}
                    today={todayById.get(space.space_id)}
                    big={i === 0 && ordered.length > 2}
                    onPreview={setPreview}
                  />
                ))
              : (
                  <div className="flex flex-col items-start justify-center gap-3 bg-wash p-8 sm:col-span-2 lg:col-span-3">
                    <b className="text-xl text-ink" style={{ fontFamily: "var(--font-display)" }}>
                      {category ? `아직 열어 둔 ${SPACE_CATEGORY_LABELS[category]} 공간이 없어요` : "아직 일정을 열어 둔 공간이 없어요"}
                    </b>
                    <p className="text-sm text-soft">첫 번째로 올리면 이 자리에 가장 먼저 보여요.</p>
                  </div>
                )}
          {!loading && <HostTile />}
        </div>
      )}

      {preview && (
        <SpacePreviewModal space={preview} today={todayById.get(preview.space_id)} onClose={() => setPreview(null)} />
      )}
    </section>
  );
}

function Chip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center whitespace-nowrap px-3.5 text-[0.85rem] transition-[background-color,box-shadow,color]",
        active
          ? "bg-sky font-bold text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]"
          : "bg-white font-medium shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink)]",
        !active && (count === 0 ? "text-soft/60" : "text-ink"),
      )}
    >
      {label}
      <span className={cn("ml-1.5 text-[0.72rem]", active ? "text-ink" : "text-soft")} style={{ fontFamily: "var(--font-label)" }}>
        {count}
      </span>
    </button>
  );
}

function HostTile() {
  return (
    <Link
      href="/spaces/new"
      className="group relative flex min-h-[300px] flex-col justify-between gap-6 overflow-hidden bg-lemon p-6 text-ink transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[0_0_0_1.5px_var(--ink),8px_8px_0_var(--ink)]"
    >
      <span className="inline-flex items-center gap-2.5 text-[0.72rem] tracking-[0.08em]" style={{ fontFamily: "var(--font-label)" }}>
        <i className="block h-3 w-3 bg-white shadow-[inset_0_0_0_1px_var(--ink)]" />
        HOST
      </span>
      <div className="flex flex-col gap-3">
        <b className="text-[clamp(1.6rem,2.2vw,2.1rem)] font-normal leading-[1.15] tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          다음 자리는
          <br />
          당신의 공간
        </b>
      </div>
      <span className="inline-flex items-center gap-1.5 self-start px-px text-sm font-bold shadow-[inset_0_-0.32em_0_white]">
        공간 등록하기
        <IconArrowRight size={15} stroke={2.2} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
