"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { applyHistory, createHistory, redoHistory, undoHistory, type History } from "../lib/history";

const STORAGE_PREFIX = "momentlit:room-draft:";

type ItemsUpdate = FurnitureItem[] | ((current: FurnitureItem[]) => FurnitureItem[]);

/** 브라우저에 남겨 두는 "지금 편집 중인 배치" — 저장 여부와 상관없이 닫았다 열어도 이어서 본다. */
interface LocalDraft {
  items: FurnitureItem[];
  /** 불러와서 고치던 저장된 배치. 없으면 새 배치. */
  layoutId: number | null;
}

function isItem(value: unknown): value is FurnitureItem {
  const item = value as FurnitureItem | null;
  return typeof item?.type === "string"
    && [item.x, item.z, item.rotation].every((v) => typeof v === "number" && Number.isFinite(v))
    && (item.y == null || (typeof item.y === "number" && Number.isFinite(item.y)));
}

function readDraft(key: string): LocalDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
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

function writeDraft(key: string, draft: LocalDraft) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(draft));
  } catch {
    // 저장 공간이 막힌 브라우저(사생활 보호 모드 등) — 화면에서는 계속 쓸 수 있다.
  }
}

/** 서버로 보내는 값과 같게 맞춰 비교한다(소수점 차이로 "안 저장됨"이 뜨지 않게). */
function normalize(items: readonly FurnitureItem[]): FurnitureItem[] {
  return items.map((item) => ({ type: item.type, x: round(item.x), z: round(item.z), y: round(item.y ?? 0), rotation: round(item.rotation, 4) }));
}

function sameItems(a: readonly FurnitureItem[], b: readonly FurnitureItem[]) {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/**
 * 3D 방 하나의 가구 배치 — 지금 편집 중인 배치(브라우저에 방마다 자동 보관)와, 로그인한 사용자가 이 방에 이름 붙여 저장한
 * 배치 목록(서버, 방마다 20개까지). 저장된 배치를 불러와 고친 뒤 덮어쓰거나, 새 배치로 따로 저장할 수 있다.
 */
export function useFurnitureLayouts(spaceId: number, roomId: number) {
  const draftKey = `${spaceId}:${roomId}`;
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);
  const queryClient = useQueryClient();
  const queryKey = ["space-room-layouts", spaceId, roomId];

  const layoutsQuery = useQuery({
    queryKey,
    queryFn: () => fetchMyFurnitureLayouts(spaceId, roomId),
    enabled: hydrated && isAuthenticated,
  });
  const layouts = isAuthenticated ? layoutsQuery.data ?? [] : [];

  // 지금 배치와 실행 취소 기록 — 되돌리기(⌘Z)·다시 실행(⌘⇧Z)
  const [history, setHistory] = useState<History<FurnitureItem[]>>(() => createHistory([]));
  const items = history.present;
  // 끌기 중인지 — 끌기 하나(움직임 여러 번)를 되돌리기 한 단계로 묶는다
  const draggingRef = useRef(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const draft = readDraft(draftKey);
    queueMicrotask(() => {
      setHistory(createHistory(draft?.items ?? []));
      setActiveId(draft?.layoutId ?? null);
      setReady(true);
    });
  }, [draftKey]);

  useEffect(() => {
    if (ready) writeDraft(draftKey, { items, layoutId: activeId });
  }, [ready, draftKey, items, activeId]);

  const update = useCallback((value: ItemsUpdate, record: boolean) => {
    setHistory((current) => applyHistory(current, typeof value === "function" ? value(current.present) : value, record));
  }, []);

  /** 한 번에 끝나는 편집(놓기·돌리기·지우기·붙여넣기 등) — 되돌리기 한 단계. */
  const setItems = useCallback((value: ItemsUpdate) => {
    draggingRef.current = false;
    update(value, true);
  }, [update]);

  /** 끌기 중 움직임 — 끌기를 시작할 때만 기록하고, 끝날 때(`endDrag`)까지는 같은 단계에 합친다. */
  const dragItems = useCallback((value: ItemsUpdate) => {
    const record = !draggingRef.current;
    draggingRef.current = true;
    update(value, record);
  }, [update]);

  const endDrag = useCallback(() => {
    draggingRef.current = false;
  }, []);

  /** 무대가 알아서 맞추는 변경(받침이 사라진 소품 내려앉히기) — 따로 되돌리지 않고 앞 단계에 합친다. */
  const adjustItems = useCallback((value: ItemsUpdate) => update(value, false), [update]);

  const undo = useCallback(() => {
    draggingRef.current = false;
    setHistory(undoHistory);
  }, []);

  const redo = useCallback(() => {
    draggingRef.current = false;
    setHistory(redoHistory);
  }, []);

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

  /** 저장된 배치를 화면에 불러온다(되돌리기로 불러오기 전으로 돌아갈 수 있다). */
  function load(layout: FurnitureLayout) {
    setItems(knownFurniture(layout.items));
    setActiveId(layout.layout_id);
    setError(null);
  }

  /** 초기화 — 가구를 모두 빼고 새 배치로 시작한다(저장한 배치는 그대로, 되돌리기로 되살릴 수 있다). */
  function startNew() {
    setItems([]);
    setActiveId(null);
    setError(null);
  }

  /** 지금 배치를 새 이름으로 저장한다. */
  function saveAsNew(name: string) {
    return run(async () => {
      const created = await createMyFurnitureLayout(spaceId, roomId, name.trim(), normalize(items));
      setLayoutsCache((current) => [created, ...current]);
      setActiveId(created.layout_id);
      return created;
    });
  }

  /** 불러와서 고치던 배치에 덮어쓴다. */
  function overwrite() {
    if (!active) return Promise.resolve(null);
    return run(async () => {
      const updated = await updateMyFurnitureLayout(spaceId, roomId, active.layout_id, active.name, normalize(items));
      setLayoutsCache((current) => [updated, ...current.filter((layout) => layout.layout_id !== updated.layout_id)]);
      return updated;
    });
  }

  function rename(layout: FurnitureLayout, name: string) {
    return run(async () => {
      const updated = await updateMyFurnitureLayout(spaceId, roomId, layout.layout_id, name.trim(), layout.items);
      setLayoutsCache((current) => current.map((item) => (item.layout_id === updated.layout_id ? updated : item)));
      return updated;
    });
  }

  function remove(layout: FurnitureLayout) {
    return run(async () => {
      await deleteMyFurnitureLayout(spaceId, roomId, layout.layout_id);
      setLayoutsCache((current) => current.filter((item) => item.layout_id !== layout.layout_id));
      // 지운 배치를 고치던 중이었으면 화면의 가구는 그대로 두고 "새 배치"로 바꾼다.
      if (layout.layout_id === activeId) setActiveId(null);
      return true;
    });
  }

  return {
    items,
    setItems,
    dragItems,
    endDrag,
    adjustItems,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
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
