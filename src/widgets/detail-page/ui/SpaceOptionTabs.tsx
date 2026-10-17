import Link from "next/link";
import { cn } from "@/shared/lib";
import type { SpaceOptionSummary } from "../model/queries";

/**
 * 같은 공간 안의 구역(1층, 2층 세미나실…) 탭. 구역마다 별도 Space라서 탭을 누르면
 * 그 구역의 상세로 이동하고, 사진·기본 정보·운영 시간·예약이 모두 그 구역 기준으로 바뀐다.
 */
export function SpaceOptionTabs({ options, currentSpaceId }: { options: SpaceOptionSummary[]; currentSpaceId: number }) {
  return (
    <nav aria-label="구역 선택" className="border-x border-b border-line bg-white p-4 sm:px-8 sm:py-5">
      <p className="mb-3 font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em] text-soft">
        구역 {options.length}곳 · 구역마다 요금과 예약 가능한 시간이 달라요
      </p>
      <div className="grid grid-cols-2 gap-px bg-line shadow-[0_0_0_1px_var(--line)] sm:flex sm:flex-wrap">
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
                "flex min-w-36 flex-1 flex-col gap-1 px-4 py-3 transition-colors",
                active ? "bg-primary-100 text-ink" : "bg-white text-ink hover:bg-wash",
              )}
            >
              <b className="break-keep text-[0.95rem] font-bold">{option.label}</b>
              <span className="text-xs text-soft">
                {option.pricePerHour.toLocaleString()}원{option.usageUnit === "DAILY" ? " / 일" : " / 시간"}
                {option.capacity != null && ` · 최대 ${option.capacity}인`}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
