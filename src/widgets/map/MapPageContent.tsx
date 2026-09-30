"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { searchSpaces } from "@/entities/space/api";
import { collectPages } from "@/widgets/search-page/lib/multi-search";
import { getErrorMessage } from "@/shared/api/error";
import { cn } from "@/shared/lib";
import { locateSpace, type SpacePin } from "./model";

const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => <div className="grid h-[55dvh] min-h-[360px] place-items-center border border-line bg-wash text-sm text-soft">지도를 불러오는 중…</div>,
});
const EMPTY_PINS: SpacePin[] = [];

export function MapPageContent() {
  const [region, setRegion] = useState<Region | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const configured = Boolean(process.env.NEXT_PUBLIC_VWORLD_API_KEY);
  const spacesQuery = useQuery({
    queryKey: ["spaces", "map", region],
    queryFn: ({ signal }) => collectPages((page) => searchSpaces({ region: region ?? undefined, page, size: 100 }, signal)),
  });
  const spaces = spacesQuery.data;
  const locationsQuery = useQuery({
    queryKey: ["spaces", "map-locations", spaces?.map((space) => [space.space_id, space.address.road_address, space.address.jibun_address])],
    enabled: configured && spaces !== undefined,
    retry: false,
    queryFn: async ({ signal }) => {
      const pins: SpacePin[] = [];
      const failed: number[] = [];
      for (let start = 0; start < (spaces?.length ?? 0); start += 4) {
        const results = await Promise.all((spaces ?? []).slice(start, start + 4).map(async (space) => {
          try {
            return await queryClient.fetchQuery({
              queryKey: ["space", "map-location", space.space_id, space.address.road_address, space.address.jibun_address],
              queryFn: () => locateSpace(space, signal), staleTime: 24 * 60 * 60 * 1000, retry: false,
            });
          } catch (error) {
            if (signal.aborted) throw error;
            failed.push(space.space_id);
            return null;
          }
        }));
        for (const pin of results) if (pin) pins.push(pin);
      }
      return { pins, failed };
    },
  });
  const pins = locationsQuery.data?.pins ?? EMPTY_PINS;
  const pinIds = new Set(pins.map((pin) => pin.space.space_id));

  return (
    <div className="page-shell min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><h1 className="page-title">지도로 보기</h1><p className="mt-2 text-sm text-soft">지도에서 공간의 위치를 살펴보고, 마음에 드는 곳을 만나보세요.</p></div>
        <Link href="/search" className="button button--outline">목록으로 검색하기</Link>
      </div>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="지도 지역 선택">
        <button type="button" aria-pressed={region === null} onClick={() => { setRegion(null); setSelectedId(null); }} className={cn("button", region === null ? "button--primary" : "button--outline")}>전체</button>
        {REGIONS.map((item) => <button key={item} type="button" aria-pressed={region === item} onClick={() => { setRegion(item); setSelectedId(null); }} className={cn("button", region === item ? "button--primary" : "button--outline")}>{REGION_LABELS[item]}</button>)}
      </div>
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {configured ? <MapCanvas pins={pins} selectedId={selectedId} onSelect={setSelectedId} /> : <div className="grid h-[55dvh] min-h-[360px] place-items-center border border-line bg-wash p-6 text-center"><p className="text-sm text-soft">지도를 준비 중이에요. 공간은 아래 목록에서 확인할 수 있어요.</p></div>}
          {locationsQuery.isFetching && <p role="status" className="mt-3 text-sm text-soft">공간의 위치를 찾는 중…</p>}
          {locationsQuery.isError && <p role="alert" className="mt-3 text-sm text-coral">위치를 불러오지 못했어요. <button className="font-bold underline" onClick={() => void locationsQuery.refetch()}>다시 시도</button></p>}
          {!!locationsQuery.data?.failed.length && <p role="alert" className="mt-3 text-sm text-coral">일부 공간의 위치를 불러오지 못했어요. <button className="font-bold underline" onClick={() => void locationsQuery.refetch()}>다시 시도</button></p>}
        </div>
        <section className="min-w-0 border border-line bg-white lg:max-h-[70dvh] lg:overflow-y-auto" aria-label="지도 공간 목록">
          <h2 className="border-b border-line p-4 text-lg font-bold">{region ? REGION_LABELS[region] : "전체"} 공간 <span className="text-main-d">{spaces?.length ?? 0}</span></h2>
          {spacesQuery.isPending && <p className="p-4 text-sm text-soft">공간을 불러오는 중…</p>}
          {spacesQuery.isError && <p role="alert" className="p-4 text-sm text-coral">{getErrorMessage(spacesQuery.error)} <button className="font-bold underline" onClick={() => void spacesQuery.refetch()}>다시 시도</button></p>}
          {spaces?.length === 0 && <p className="p-4 text-sm text-soft">아직 등록된 공간이 없어요.</p>}
          {spaces?.map((space) => <article key={space.space_id} className={cn("border-b border-line p-4 last:border-0", selectedId === space.space_id && "bg-primary-100")}>
            <h3 className="font-bold">{space.name}</h3>
            <p className="mt-1 break-words text-xs leading-relaxed text-soft">{space.address.road_address}</p>
            <p className="mt-2 text-sm">{space.price_per_hour.toLocaleString()}원</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pinIds.has(space.space_id) && <button className="button button--outline" type="button" onClick={() => setSelectedId(space.space_id)}>위치 보기</button>}
              <Link href={`/spaces/${space.space_id}`} className="button button--primary">상세 보기</Link>
            </div>
          </article>)}
        </section>
      </div>
    </div>
  );
}
