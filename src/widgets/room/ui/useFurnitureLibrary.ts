"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth/store";
import { fetchMyFurniture, type CustomFurniture } from "@/entities/room";
import { customFurnitureDef } from "../lib/customFurniture";
import { registerCustomFurniture, registerPolyHavenFurniture, type FurnitureDef } from "../lib/furniture";
import { fetchPolyHavenFurniture } from "../lib/polyHaven";

const NONE: FurnitureDef[] = [];
const NO_MINE: CustomFurniture[] = [];
/** 사진으로 만드는 중인 내 가구가 있으면 이 간격으로 다시 본다(한 건에 2분쯤). */
const PROCESSING_POLL_MS = 4000;

export const MY_FURNITURE_QUERY_KEY = ["my-furniture"] as const;

/**
 * 고를 수 있는 모델 가구 전체 — 내 가구(로그인했을 때, 다 만든 것만 놓을 수 있음) + Poly Haven 실내 물건 목록.
 * 받은 가구는 `findFurniture`가 찾을 수 있게 등록한다. 못 받으면 기본 도형 가구만 쓴다.
 * `key`는 등록된 가구가 바뀔 때마다 달라진다 — 무대가 상자로 먼저 그린 가구를 모델로 다시 그리는 신호.
 */
export function useFurnitureLibrary() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);

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

  const signedIn = hydrated && isAuthenticated && Boolean(userId);
  const myFurniture = useQuery({
    queryKey: [...MY_FURNITURE_QUERY_KEY, userId],
    queryFn: fetchMyFurniture,
    enabled: signedIn,
    refetchInterval: (query) => (query.state.data?.some((item) => item.status === "PROCESSING") ? PROCESSING_POLL_MS : false),
    // 컴퓨터가 잠들었다 깨는 등으로 늦게 끝난 생성(서버가 FAILED → READY로 되살림)도 창으로 돌아오면 보이게
    refetchOnWindowFocus: true,
  });
  const mine = signedIn ? myFurniture.data ?? NO_MINE : NO_MINE;

  const customDefs = useMemo(
    () => mine.map(customFurnitureDef).filter((def): def is FurnitureDef => def !== null),
    [mine],
  );
  // 렌더 중에 바로 등록해야 같은 렌더의 무대·도면이 찾을 수 있다(효과로 미루면 한 번 상자로 그려진다)
  registerCustomFurniture(customDefs);
  useEffect(() => () => registerCustomFurniture([]), []);

  const polyHavenItems = polyHaven.data ?? NONE;
  const items = useMemo(() => [...customDefs, ...polyHavenItems], [customDefs, polyHavenItems]);

  return {
    items,
    /** 내 가구 전체(만드는 중·실패 포함) — 가구 창 "내 가구"에 상태와 함께 보여 준다. */
    mine,
    signedIn,
    mineLoading: signedIn && myFurniture.isLoading,
    key: `${polyHavenItems.length}:${customDefs.map((def) => def.id).join(",")}`,
    loading: polyHaven.isLoading,
    failed: polyHaven.isError,
    usesPolyHaven: polyHavenItems.length > 0,
  };
}
