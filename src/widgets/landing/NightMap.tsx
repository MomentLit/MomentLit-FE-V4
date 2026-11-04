"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { IconArrowRight } from "@tabler/icons-react";
import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { useSpaceDisplayCounts } from "@/entities/space/queries";
import { cn } from "@/shared/lib";
import { Reveal } from "./Reveal";

/** 권역 중심 좌표(경도, 위도) — 점이 어느 권역에 속할지 가장 가까운 중심으로 나눈다. */
const REGION_CENTERS: Record<Region, [number, number]> = {
  SEOUL: [126.98, 37.56],
  GYEONGGI_INCHEON: [127.12, 37.42],
  BUSAN_GYEONGNAM: [128.45, 35.3],
  DAEGU_GYEONGBUK: [128.75, 36.3],
  DAEJEON_CHUNGCHEONG: [127.0, 36.6],
  GWANGJU_JEOLLA: [126.95, 35.2],
  GANGWON: [128.3, 37.72],
  JEJU: [126.55, 33.38],
};

/** 한반도 남쪽 외곽선(대략) — 이 안쪽 격자점만 점으로 찍는다. */
const OUTLINE: Array<[number, number]> = [
  [126.15, 37.72], [126.55, 37.78], [126.68, 37.95], [126.95, 38.03], [127.2, 38.25], [127.55, 38.3], [127.85, 38.3], [128.1, 38.35], [128.35, 38.6],
  [128.5, 38.4], [128.7, 38.1], [128.95, 37.8], [129.12, 37.55], [129.3, 37.3], [129.38, 37.0], [129.42, 36.7], [129.45, 36.4], [129.55, 36.1], [129.58, 35.95],
  [129.45, 35.8], [129.47, 35.5], [129.35, 35.3], [129.15, 35.12], [128.95, 35.04], [128.75, 34.95], [128.6, 34.85], [128.35, 34.83], [128.1, 34.85], [127.85, 34.75],
  [127.6, 34.65], [127.4, 34.55], [127.2, 34.5], [127.0, 34.5], [126.75, 34.4], [126.5, 34.3], [126.35, 34.42], [126.3, 34.7], [126.4, 35.0], [126.45, 35.3],
  [126.5, 35.6], [126.65, 35.95], [126.55, 36.2], [126.5, 36.45], [126.3, 36.7], [126.15, 36.85], [126.35, 36.95], [126.75, 37.05], [126.65, 37.3], [126.6, 37.45],
  [126.55, 37.6], [126.4, 37.65],
];

function inOutline(lon: number, lat: number) {
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const project = (lon: number, lat: number) => ({ x: +((lon - 126) * 89).toFixed(1), y: +((38.75 - lat) * 111).toFixed(1) });

function regionAt(lon: number, lat: number): Region | null {
  const jeju = ((lon - 126.55) / 0.42) ** 2 + ((lat - 33.38) / 0.17) ** 2 < 1;
  if (jeju) return "JEJU";
  if (!inOutline(lon, lat)) return null;
  const sx = (lon - 126.98) * 89;
  const sy = (lat - 37.56) * 111;
  if (Math.hypot(sx, sy) < 17) return "SEOUL";
  let best: Region | null = null;
  let bestDist = Infinity;
  for (const region of REGIONS) {
    if (region === "SEOUL" || region === "JEJU") continue;
    const [cx, cy] = REGION_CENTERS[region];
    const dist = ((lon - cx) * 89) ** 2 + ((lat - cy) * 111) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = region;
    }
  }
  return best;
}

/** 실제 지도를 점으로 옮긴 모식도. 모듈 로드 때 한 번만 계산한다. */
const DOTS: Array<{ x: number; y: number; region: Region }> = (() => {
  const dots: Array<{ x: number; y: number; region: Region }> = [];
  for (let lat = 38.7; lat > 33; lat -= 0.09) {
    for (let lon = 126.05; lon < 129.65; lon += 0.11) {
      const region = regionAt(lon, lat);
      if (region) dots.push({ ...project(lon, lat), region });
    }
  }
  return dots;
})();

// 흰 배경 테마 — 점은 옅은 회색, 마우스를 올린 권역은 하늘색, 공간이 있는 곳은 하늘색 불빛이 퍼진다.
const NIGHT = {
  bg: "#FFFFFF",
  fg: "#15171C",
  fg2: "#71757E",
  faint: "rgba(21,23,28,.38)",
  line: "#E7E9EE",
  dot: "#E3E6EC",
  dotHi: "#9FD8FA",
  warm: "#5FC5FC",
  count: "#1D6FE0",
};

const mapHref = (region?: Region) => (region ? `/map?region=${region}` : "/map");

/**
 * 랜딩 "지도로 보는 공간" — 권역별 점지도. 공간이 있는 권역에 불빛 점이 깜빡이고,
 * 권역(점·목록)을 누르면 그 권역이 선택된 지도 페이지로, 버튼은 전체 지도로 넘어간다.
 */
export function NightMap() {
  const router = useRouter();
  const { data } = useSpaceDisplayCounts();
  const [active, setActive] = useState<Region | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);

  const counts = new Map(data?.byRegion.map((item) => [item.region, item.count]));
  const countOf = (region: Region) => counts.get(region) ?? 0;

  const regionFromEvent = (event: MouseEvent<SVGSVGElement>) =>
    ((event.target as Element).getAttribute("data-region") as Region | null) ?? null;

  return (
    <section
      aria-labelledby="night-map-title"
      className="relative overflow-hidden border-b border-line px-4 py-16 sm:px-6 sm:py-20 lg:py-28"
      style={{ background: NIGHT.bg, color: NIGHT.fg }}
    >
      {/* 모바일은 제목 → 지도 → 권역 목록 순, PC는 왼쪽(제목·목록) / 오른쪽(지도) 2단. */}
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:gap-x-20 lg:gap-y-8">
        <Reveal className="flex flex-col gap-5 lg:col-start-1 lg:row-start-1">
          <h2
            id="night-map-title"
            className="text-[clamp(2rem,4.6vw,3.6rem)] leading-[1.08] tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            지도로 보는
            <br />
            공간
          </h2>
          <p className="max-w-[34em] text-[0.95rem] leading-[1.75]" style={{ color: NIGHT.fg2 }}>
            불이 켜진 곳이 지금 빌릴 수 있는 공간이에요. 권역을 누르면 지도에서 바로 위치를 볼 수 있어요.
          </p>
        </Reveal>

        <Reveal
          delayMs={120}
          className="relative mx-auto w-full max-w-[300px] sm:max-w-[340px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-[420px] lg:self-center"
        >
          <svg
            viewBox="-6 -6 332 638"
            role="img"
            aria-label="권역별 공간 지도. 권역을 누르면 지도 페이지로 이동해요."
            className="block h-auto w-full cursor-pointer overflow-visible"
            onMouseMove={(event) => {
              const region = regionFromEvent(event);
              setActive(region);
              const box = event.currentTarget.parentElement!.getBoundingClientRect();
              setTip(region ? { x: event.clientX - box.left, y: event.clientY - box.top } : null);
            }}
            onMouseLeave={() => {
              setActive(null);
              setTip(null);
            }}
            onClick={(event) => {
              const region = regionFromEvent(event);
              router.push(mapHref(region ?? undefined));
            }}
          >
            <defs>
              <filter id="night-map-glow" x="-200%" y="-200%" width="500%" height="500%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {DOTS.map((dot) => {
              // 평소엔 모두 꺼 두고, 마우스를 올린 권역에만 불을 켠다.
              const fill = active === dot.region ? NIGHT.dotHi : NIGHT.dot;
              return (
                <circle
                  key={`${dot.x}:${dot.y}`}
                  data-region={dot.region}
                  cx={dot.x}
                  cy={dot.y}
                  r={3}
                  fill={fill}
                  // 점 사이 틈을 눌러도 그 권역이 잡히게 투명 테두리로 클릭 영역을 넓힌다.
                  stroke="transparent"
                  strokeWidth={7}
                  className="transition-[fill] duration-300"
                />
              );
            })}
            {REGIONS.filter((region) => countOf(region) > 0).map((region) => {
              const { x, y } = project(...REGION_CENTERS[region]);
              return (
                <g key={region} className="pointer-events-none">
                  <circle cx={x} cy={y} r={9} fill="none" stroke={NIGHT.warm} strokeWidth={0.7} className="night-map-ping" />
                  <circle cx={x} cy={y} r={5} fill={NIGHT.warm} filter="url(#night-map-glow)" />
                </g>
              );
            })}
          </svg>

          {tip && active && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-[140%] whitespace-nowrap px-2.5 py-1.5 text-[0.78rem] font-bold"
              style={{ left: tip.x, top: tip.y, background: NIGHT.fg, color: NIGHT.bg }}
            >
              {REGION_LABELS[active]} · {countOf(active)}곳
            </span>
          )}

          <p className="mt-3 text-center text-[0.66rem]" style={{ fontFamily: "var(--font-label)", color: NIGHT.faint }}>
            실제 지도를 점으로 옮긴 모식도예요. 권역을 누르면 지도에서 그 지역을 보여 줘요.
          </p>
        </Reveal>
        <Reveal delayMs={80} className="flex flex-col gap-5 lg:col-start-1 lg:row-start-2">
          <ul className="flex flex-col" style={{ boxShadow: `inset 0 1px 0 ${NIGHT.line}` }}>
            {REGIONS.map((region, i) => {
              const count = countOf(region);
              const hi = active === region;
              return (
                <li key={region}>
                  <Link
                    href={mapHref(region)}
                    onMouseEnter={() => setActive(region)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(region)}
                    onBlur={() => setActive(null)}
                    className={cn(
                      "grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-3.5 py-3 transition-[padding] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]",
                      hi && "pl-2.5",
                    )}
                    style={{ boxShadow: `inset 0 -1px 0 ${NIGHT.line}` }}
                  >
                    <span className="text-[0.72rem]" style={{ fontFamily: "var(--font-label)", color: NIGHT.faint }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <b className="text-base font-bold">{REGION_LABELS[region]}</b>
                    <em
                      className="text-xs not-italic"
                      style={{ fontFamily: "var(--font-label)", color: count > 0 ? NIGHT.count : NIGHT.faint }}
                    >
                      {data ? `${String(count).padStart(2, "0")}곳` : "—"}
                    </em>
                  </Link>
                </li>
              );
            })}
          </ul>

          <Link
            href="/map"
            className="group mt-2 inline-flex items-center gap-2 self-start px-5 py-3 text-sm font-bold transition-colors"
            style={{ background: NIGHT.fg, color: NIGHT.bg }}
          >
            지도로 공간 찾기
            <IconArrowRight aria-hidden size={16} stroke={2.2} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>

      </div>
    </section>
  );
}
