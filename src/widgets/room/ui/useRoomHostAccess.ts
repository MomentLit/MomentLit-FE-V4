"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth/store";
import { fetchRooms } from "@/entities/room";
import { fetchSpace } from "@/entities/space/api";
import { resolvePanoramaScenes } from "@/widgets/panorama";
import { useRequireAuth } from "@/widgets/auth";

/**
 * 3D 방 관리·만들기 화면 공통 — 로그인을 요구하고, 공간·장면·방을 불러와 호스트 본인(또는 관리자)인지 본다.
 * 서버도 같은 권한을 다시 확인한다(여기서는 화면을 막는 용도).
 */
export function useRoomHostAccess(spaceId: number) {
  const { ready } = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const spaceQuery = useQuery({ queryKey: ["space", spaceId], queryFn: () => fetchSpace(spaceId), enabled: ready });
  const roomsQuery = useQuery({ queryKey: ["space-rooms", spaceId], queryFn: () => fetchRooms(spaceId), enabled: ready });

  const space = spaceQuery.data;
  const canManage = Boolean(space && user && (user.role === "ADMIN" || space.host_id === user.id));
  const scenes = space ? resolvePanoramaScenes(space.panorama_scenes, space.panorama_url) : [];

  const status: "login" | "loading" | "error" | "forbidden" | "ready" = !ready
    ? "login"
    : spaceQuery.isPending || roomsQuery.isPending
      ? "loading"
      : spaceQuery.isError || roomsQuery.isError
        ? "error"
        : !canManage
          ? "forbidden"
          : "ready";

  return { status, space, scenes, rooms: roomsQuery.data ?? [] };
}

export const ROOM_ACCESS_MESSAGES = {
  login: "로그인이 필요해요.",
  loading: "불러오는 중…",
  error: "공간을 불러오지 못했어요.",
  forbidden: "이 공간의 호스트만 3D 방을 만들 수 있어요.",
} as const;
