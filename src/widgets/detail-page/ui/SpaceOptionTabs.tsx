import Link from "next/link";
import { cn } from "@/shared/lib";
import { formatPriceAmount } from "@/entities/space";
import type { SpaceOptionSummary } from "../model/queries";

/**
 * 같은 공간 안의 구역(1층, 2층 세미나실…) 탭. 구역마다 별도 Space라서 탭을 누르면
 * 그 구역의 상세로 이동하고, 사진·기본 정보·운영 시간·예약이 모두 그 구역 기준으로 바뀐다.
 */
export function SpaceOptionTabs({ options, currentSpaceId }: { options: SpaceOptionSummary[]; currentSpaceId: number }) {
  return (
    <nav aria-label="구역 선택" className="border-x border-b border-line bg-white">
      {/* 박스 안에 박스를 두지 않고, 구역 탭이 폭 전체를 나눠 쓴다. 모바일은 2칸씩 — 마지막 줄에 남는
          자리는 그 줄 탭이 나눠 채운다. 칸 사이 구분선은 바깥 그림자 1px를 겹쳐 그린다. */}
      <div className="flex flex-wrap">
        {options.map((option) => {
          const active = option.spaceId === currentSpaceId;
          return (
            <Link
              key={option.spaceId}
              href={`/spaces/${option.spaceId}`}
              replace
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 basis-1/2 flex-col gap-1.5 px-5 py-5 transition-colors sm:basis-0 sm:px-8 sm:py-6",
                active ? "bg-wash text-ink shadow-[inset_0_-3px_0_var(--ink),0_0_0_0.5px_var(--line)]" : "bg-white text-soft shadow-[0_0_0_0.5px_var(--line)] hover:bg-wash hover:text-ink",
              )}
            >
              <b className={cn("break-keep text-lg tracking-tight sm:text-xl", active ? "font-extrabold text-ink" : "font-bold")}>{option.label}</b>
              <span className="text-[0.8rem] text-soft">
                {formatPriceAmount(option.pricePerHour)}
                {option.pricePerHour != null && (option.usageUnit === "DAILY" ? " / 일" : " / 시간")}
                {option.capacity != null && ` · 최대 ${option.capacity}인`}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
