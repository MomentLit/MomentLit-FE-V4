"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth/store";
import {
  createMyFurnitureLayout,
  deleteMyFurnitureLayout,
  fetchMyFurnitureLayouts,
  MAX_FURNITURE_LAYOUTS,
  updateMyFurnitureLayout,
  type FurnitureItem,
  type FurnitureLayout,
} from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { knownFurniture } from "../lib/furniture";
import { round } from "../lib/geometry";

const STORAGE_PREFIX = "momentlit:room-draft:";

/** 브라우저에 남겨 두는 "지금 편집 중인 배치" — 저장 여부와 상관없이 닫았다 열어도 이어서 본다. */
interface LocalDraft {
  items: FurnitureItem[];
  /** 불러와서 고치던 저장된 배치. 없으면 새 배치. */
  layoutId: number | null;
}

function isItem(value: unknown): value is FurnitureItem {
  const item = value as FurnitureItem | null;
  return typeof item?.type === "string" && [item.x, item.z, item.rotation].every((v) => typeof v === "number" && Number.isFinite(v));
}

function readDraft(spaceId: number): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + spaceId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraft> | null;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return {
      items: knownFurniture(parsed.items.filter(isItem)),
      layoutId: typeof parsed.layoutId === "number" ? parsed.layoutId : null,
    };
  } catch {
    return null;
  }
}

function writeDraft(spaceId: number, draft: LocalDraft) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + spaceId, JSON.stringify(draft));
  } catch {
    // 저장 공간이 막힌 브라우저(사생활 보호 모드 등) — 화면에서는 계속 쓸 수 있다.
  }
}

/** 서버로 보내는 값과 같게 맞춰 비교한다(소수점 차이로 "안 저장됨"이 뜨지 않게). */
function normalize(items: readonly FurnitureItem[]): FurnitureItem[] {
  return items.map((item) => ({ type: item.type, x: round(item.x), z: round(item.z), rotation: round(item.rotation, 4) }));
}

function sameItems(a: readonly FurnitureItem[], b: readonly FurnitureItem[]) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/**
 * 3D 방 가구 배치 — 지금 편집 중인 배치(브라우저에 자동 보관)와, 로그인한 사용자가 이름 붙여 저장한 배치 목록(서버, 20개까지).
 * 저장된 배치를 불러와 고친 뒤 덮어쓰거나, 새 배치로 따로 저장할 수 있다.
 */
export function useFurnitureLayouts(spaceId: number) {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  const queryKey = ["space-room-layouts", spaceId];

  const layoutsQuery = useQuery({
    queryKey,
    queryFn: () => fetchMyFurnitureLayouts(spaceId),
    enabled: hydrated && isAuthenticated,
  });
  const layouts = isAuthenticated ? layoutsQuery.data ?? [] : [];

  const [items, setItems] = useState<FurnitureItem[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const draft = readDraft(spaceId);
    queueMicrotask(() => {
      setItems(draft?.items ?? []);
      setActiveId(draft?.layoutId ?? null);
      setReady(true);
    });
  }, [spaceId]);

  useEffect(() => {
    if (ready) writeDraft(spaceId, { items, layoutId: activeId });
  }, [ready, spaceId, items, activeId]);

  // 고치던 배치가 목록에 없으면(다른 기기에서 지웠거나 로그아웃) 새 배치로 본다.
  const active = layouts.find((layout) => layout.layout_id === activeId) ?? null;
  const dirty = !sameItems(items, active ? knownFurniture(active.items) : []);

  function setLayoutsCache(update: (current: FurnitureLayout[]) => FurnitureLayout[]) {
    queryClient.setQueryData<FurnitureLayout[]>(queryKey, (current) => update(current ?? []));
  }

  async function run<T>(task: () => Promise<T>): Promise<T | null> {
    if (!isAuthenticated) {
      openAuthModal();
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      return await task();
    } catch (taskError) {
      setError(getErrorMessage(taskError));
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** 저장된 배치를 화면에 불러온다. */
  function load(layout: FurnitureLayout) {
    setItems(knownFurniture(layout.items));
    setActiveId(layout.layout_id);
    setError(null);
  }

  /** 빈 방에서 새 배치를 시작한다. */
  function startNew() {
    setItems([]);
    setActiveId(null);
    setError(null);
  }

  /** 지금 배치를 새 이름으로 저장한다. */
  function saveAsNew(name: string) {
    return run(async () => {
      const created = await createMyFurnitureLayout(spaceId, name.trim(), normalize(items));
      setLayoutsCache((current) => [created, ...current]);
      setActiveId(created.layout_id);
      return created;
    });
  }

  /** 불러와서 고치던 배치에 덮어쓴다. */
  function overwrite() {
    if (!active) return Promise.resolve(null);
    return run(async () => {
      const updated = await updateMyFurnitureLayout(spaceId, active.layout_id, active.name, normalize(items));
      setLayoutsCache((current) => [updated, ...current.filter((layout) => layout.layout_id !== updated.layout_id)]);
      return updated;
    });
  }

  function rename(layout: FurnitureLayout, name: string) {
    return run(async () => {
      const updated = await updateMyFurnitureLayout(spaceId, layout.layout_id, name.trim(), layout.items);
      setLayoutsCache((current) => current.map((item) => (item.layout_id === updated.layout_id ? updated : item)));
      return updated;
    });
  }

  function remove(layout: FurnitureLayout) {
    return run(async () => {
      await deleteMyFurnitureLayout(spaceId, layout.layout_id);
      setLayoutsCache((current) => current.filter((item) => item.layout_id !== layout.layout_id));
      // 지운 배치를 고치던 중이었으면 화면의 가구는 그대로 두고 "새 배치"로 바꾼다.
      if (layout.layout_id === activeId) setActiveId(null);
      return true;
    });
  }

  return {
    items,
    setItems,
    ready,
    layouts,
    layoutsLoading: isAuthenticated && layoutsQuery.isPending,
    active,
    dirty,
    busy,
    error,
    isAuthenticated,
    limitReached: layouts.length >= MAX_FURNITURE_LAYOUTS,
    openLogin: openAuthModal,
    load,
    startNew,
    saveAsNew,
    overwrite,
    rename,
    remove,
  };
}
