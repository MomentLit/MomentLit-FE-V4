import { cn } from "@/shared/lib";
import { formatRanges, type TodayStatus } from "./today";

/**
 * 오늘 빈 시간 막대 — 한 칸이 한 시간. 기본 10시~22시를 보여 주고, 운영 시간이 그 밖으로
 * 나가면 그만큼 넓힌다. 켜진 칸은 공간 카테고리 색(`--ac`)으로 칠한다.
 */
export function TodayRibbon({ status, className }: { status: TodayStatus | undefined; className?: string }) {
  const ranges = status?.kind === "open" ? status.ranges : [];
  const from = Math.max(0, Math.min(10, ...ranges.map(([start]) => Math.floor(start))));
  const to = Math.min(24, Math.max(22, ...ranges.map(([, end]) => Math.ceil(end))));
  const hours = Array.from({ length: to - from }, (_, i) => from + i);
  const isOn = (hour: number) => ranges.some(([start, end]) => hour + 0.5 > start && hour + 0.5 < end);

  const text =
    status === undefined
      ? "확인 중…"
      : status.kind === "open"
        ? formatRanges(status.ranges)
        : status.kind === "booked"
          ? "예약 마감"
          : "오늘은 쉬어요";

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex min-w-0 justify-between gap-2.5 text-[0.78rem] text-soft">
        <span className="shrink-0">오늘 빈 시간</span>
        <b className={cn("min-w-0 truncate font-normal", status?.kind === "open" ? "text-ink" : "text-soft")} style={{ fontFamily: "var(--font-label)" }}>
          {text}
        </b>
      </div>
      <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }} aria-hidden>
        {hours.map((hour) => (
          <i key={hour} className="block h-2" style={{ background: isOn(hour) ? "var(--ac, var(--sky))" : "var(--line)" }} />
        ))}
      </div>
    </div>
  );
}
