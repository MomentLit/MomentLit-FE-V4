"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { IconEye, IconHeart, IconHeartFilled } from "@tabler/icons-react";
import { useAuthStore } from "@/entities/auth";
import type { GroupedSpace, SpaceListItem } from "@/entities/space";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { REGION_LABELS } from "@/entities/region";
import { cn } from "@/shared/lib";
import { useSpaceLikeStatusQuery, useToggleSpaceLikeMutation } from "@/widgets/detail-page/model/queries";
import { TodayRibbon } from "./TodayRibbon";
import type { TodayStatus } from "./today";

export type SpotlightSpace = GroupedSpace<SpaceListItem>;

const TONE_BG: Record<string, string> = {
  sky: "bg-sky",
  lime: "bg-lime",
  lemon: "bg-lemon",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

export const toneVar = (space: SpaceListItem) => `var(--${SPACE_CATEGORY_COLORS[space.category]})`;

export function placeText(space: SpaceListItem) {
  const region = space.address.region ? REGION_LABELS[space.address.region] : space.address.sido;
  const local = [space.address.sigungu, space.address.eup_myeon_dong].filter(Boolean).join(" ");
  return [region, local].filter(Boolean).join(" · ");
}

export function priceText(space: SpotlightSpace) {
  const price = space.option_group ? space.option_group.minPrice : space.price_per_hour;
  return { amount: `${price.toLocaleString()}원${space.option_group ? "~" : ""}`, unit: space.usage_unit === "DAILY" ? "/ 일" : "/ 시간" };
}

/** 사진이 없으면 카테고리 색 면에 카테고리 이름을 크게 깐다. */
export function SpacePhoto({ space, className }: { space: SpaceListItem; className?: string }) {
  if (space.thumbnail_url) {
    // eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL
    return <img src={space.thumbnail_url} alt="" className={cn("h-full w-full object-cover", className)} />;
  }
  return (
    <div className={cn("flex h-full w-full items-end p-4", TONE_BG[SPACE_CATEGORY_COLORS[space.category]], className)}>
      <span className="text-[clamp(1.6rem,3vw,2.6rem)] leading-none text-ink/80" style={{ fontFamily: "var(--font-display)" }}>
        {SPACE_CATEGORY_LABELS[space.category]}
      </span>
    </div>
  );
}

function LikeButton({ space }: { space: SpaceListItem }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const status = useSpaceLikeStatusQuery(space.space_id);
  const liked = status.data?.is_liked ?? false;
  const toggle = useToggleSpaceLikeMutation(space.space_id, liked);

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={`${space.name} 관심 ${liked ? "해제" : "저장"}`}
      disabled={toggle.isPending}
      onClick={() => (isAuthenticated ? toggle.mutate() : openAuthModal())}
      className={cn(
        "grid h-9 w-9 place-items-center transition-colors",
        liked ? "bg-ink text-white" : "bg-white text-ink hover:bg-lemon",
      )}
    >
      {liked ? <IconHeartFilled size={17} aria-hidden /> : <IconHeart size={17} stroke={1.8} aria-hidden />}
    </button>
  );
}

/**
 * 랜딩 "지금 바로 요청할 수 있는 공간" 카드. 카드 전체가 상세로 가는 링크이고(겹쳐 깐 Link),
 * 그 위에 미리보기(눈)·관심 버튼을 올린다. `big`이면 2×2 칸을 차지한다.
 */
export function SpotlightCard({
  space,
  today,
  big = false,
  onPreview,
}: {
  space: SpotlightSpace;
  today: TodayStatus | undefined;
  big?: boolean;
  onPreview: (space: SpotlightSpace) => void;
}) {
  const price = priceText(space);

  return (
    <article
      className={cn("group relative flex min-w-0 flex-col gap-3.5", big && "sm:col-span-2 lg:row-span-2")}
      style={{ "--ac": toneVar(space) } as CSSProperties}
    >
      <div
        className={cn(
          "relative overflow-hidden transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[0_0_0_1.5px_var(--ink),8px_8px_0_var(--ac)]",
          big ? "aspect-[4/3] lg:aspect-auto lg:min-h-[360px] lg:flex-1" : "aspect-[4/3]",
        )}
      >
        <div className="absolute inset-0 transition-transform duration-[900ms] ease-[cubic-bezier(.2,.8,.2,1)] group-hover:scale-[1.04]">
          <SpacePhoto space={space} />
        </div>
        <span className="absolute left-2.5 top-2.5 z-[2] inline-flex h-6 items-center gap-1.5 bg-white px-2 text-xs font-bold text-ink">
          <i className="block h-2 w-2" style={{ background: "var(--ac)" }} />
          {SPACE_CATEGORY_LABELS[space.category]}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <b
            className={cn("truncate text-ink", big ? "text-[clamp(1.6rem,2.4vw,2.2rem)] font-normal tracking-tight" : "text-[1.06rem] font-bold tracking-tight")}
            style={big ? { fontFamily: "var(--font-display)" } : undefined}
          >
            {space.name}
          </b>
          <span className="truncate text-[0.82rem] text-soft">
            {placeText(space)}
            {space.option_group && ` · 구역 ${space.option_group.count}곳`}
          </span>
        </div>
        <TodayRibbon status={today} />
        <div className="flex items-baseline justify-between gap-2.5 pt-3 shadow-[inset_0_1px_0_var(--line)]">
          <b className="text-base font-bold tabular-nums text-ink">
            {price.amount}
            <small className="ml-1 text-[0.8rem] font-normal text-soft">{price.unit}</small>
          </b>
          {space.capacity != null && (
            <span className="text-[0.72rem] text-soft" style={{ fontFamily: "var(--font-label)" }}>
              최대 {space.capacity}인
            </span>
          )}
        </div>
      </div>

      {/* 카드 전체를 덮는 링크 — 버튼들은 z-index로 그 위에 올라온다. */}
      <Link href={`/spaces/${space.space_id}`} className="absolute inset-0 z-[1]" aria-label={`${space.name} 보기`} />

      <span className="absolute right-2.5 top-2.5 z-[3] flex gap-1.5">
        <button
          type="button"
          onClick={() => onPreview(space)}
          aria-label={`${space.name} 미리보기`}
          className="grid h-9 w-9 place-items-center bg-white text-ink transition-colors hover:bg-lemon"
        >
          <IconEye size={17} stroke={1.8} aria-hidden />
        </button>
        <LikeButton space={space} />
      </span>
    </article>
  );
}
