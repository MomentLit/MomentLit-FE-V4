"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth/store";
import { fetchMyFurnitureLayout, saveMyFurnitureLayout, type FurnitureItem } from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { knownFurniture } from "../lib/furniture";
import { round } from "../lib/geometry";

const STORAGE_PREFIX = "momentlit:room-layout:";

function readLocal(spaceId: number): FurnitureItem[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + spaceId);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return knownFurniture(parsed.filter((item): item is FurnitureItem =>
      typeof item?.type === "string" && [item.x, item.z, item.rotation].every((v) => typeof v === "number" && Number.isFinite(v))));
  } catch {
    return null;
  }
}

function writeLocal(spaceId: number, items: readonly FurnitureItem[]) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + spaceId, JSON.stringify(items));
  } catch {
    // 저장 공간이 막힌 브라우저(사생활 보호 모드 등) — 화면에서는 계속 쓸 수 있다.
  }
}

function sameItems(a: readonly FurnitureItem[], b: readonly FurnitureItem[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * 3D 방 가구 배치 — 로그인하면 서버에 "내 배치"로 저장하고, 로그인하지 않았으면 이 브라우저에만 남긴다.
 * 처음 열 때는 서버에 저장한 배치 → 브라우저에 남은 배치 → 빈 방 순서로 불러온다.
 */
export function useFurnitureLayout(spaceId: number) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();

  const serverQuery = useQuery({
    queryKey: ["space-room-layout", spaceId],
    queryFn: () => fetchMyFurnitureLayout(spaceId),
    enabled: hydrated && isAuthenticated,
  });

  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [saved, setSaved] = useState<FurnitureItem[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);

  // 처음 한 번 채운다. 로그인 상태면 서버 응답을 기다린다(실패하면 브라우저 배치로).
  useEffect(() => {
    if (initializedRef.current || !hydrated) return;
    if (isAuthenticated && serverQuery.isPending) return;
    initializedRef.current = true;
    const server = serverQuery.data ? knownFurniture(serverQuery.data.items) : null;
    const initial = server ?? readLocal(spaceId) ?? [];
    queueMicrotask(() => {
      setItems(initial);
      setSaved(server);
      setReady(true);
    });
  }, [hydrated, isAuthenticated, serverQuery.isPending, serverQuery.data, spaceId]);

  // 창을 연 뒤에 로그인했으면 — 지금 화면의 배치는 그대로 두고, 서버에 저장된 것과 비교만 한다.
  useEffect(() => {
    if (!ready || !serverQuery.isSuccess || !serverQuery.data) return;
    const server = knownFurniture(serverQuery.data.items);
    queueMicrotask(() => setSaved((current) => current ?? server));
  }, [ready, serverQuery.isSuccess, serverQuery.data]);

  // 로그인하지 않았어도 닫았다 열면 이어서 볼 수 있게 브라우저에 남긴다.
  useEffect(() => {
    if (ready) writeLocal(spaceId, items);
  }, [ready, spaceId, items]);

  async function save() {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = items.map((item) => ({ ...item, x: round(item.x), z: round(item.z), rotation: round(item.rotation, 4) }));
      const layout = await saveMyFurnitureLayout(spaceId, payload);
      setSaved(knownFurniture(layout.items));
      queryClient.setQueryData(["space-room-layout", spaceId], layout);
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  const dirty = isAuthenticated && !sameItems(
    items.map((item) => ({ ...item, x: round(item.x), z: round(item.z), rotation: round(item.rotation, 4) })),
    saved ?? [],
  );

  return { items, setItems, ready, save, saving, dirty, error, isAuthenticated, hasSaved: saved !== null };
}
