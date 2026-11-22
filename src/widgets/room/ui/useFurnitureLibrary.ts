"use client";

import { useQuery } from "@tanstack/react-query";
import { registerPolyHavenFurniture, type FurnitureDef } from "../lib/furniture";
import { fetchPolyHavenFurniture } from "../lib/polyHaven";

const NONE: FurnitureDef[] = [];

/**
 * 고를 수 있는 모델 가구 전체 — Poly Haven 실내 물건 목록(등록 없이 바로). 받은 가구는 `findFurniture`가 찾을 수 있게 등록한다.
 * 못 받으면 기본 도형 가구만 쓴다. `key`는 등록된 가구가 바뀔 때마다 달라진다 — 무대가 상자로 먼저 그린 가구를 모델로 다시 그리는 신호.
 */
export function useFurnitureLibrary() {
  const polyHaven = useQuery({
    queryKey: ["furniture-polyhaven"],
    queryFn: async () => {
      const items = await fetchPolyHavenFurniture();
      registerPolyHavenFurniture(items);
      return items;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
  const items = polyHaven.data ?? NONE;
  return {
    items,
    key: String(items.length),
    loading: polyHaven.isLoading,
    failed: polyHaven.isError,
    usesPolyHaven: items.length > 0,
  };
}
