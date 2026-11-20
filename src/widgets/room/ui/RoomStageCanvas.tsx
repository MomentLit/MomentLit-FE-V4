"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import type { PickMode, RoomStage, RoomStageCallbacks, RoomStageState, RoomView, StageFurniture } from "../lib/stage";

const LOAD_ERROR_MESSAGE = "360° 사진을 불러오지 못했어요.";
const NO_FURNITURE: readonly StageFurniture[] = [];

/**
 * `RoomStage`(three.js)를 감싸는 캔버스. 안쪽이 모두 absolute라 `className`으로 높이를 꼭 정해야 한다
 * (예: `h-[480px]`, 부모 높이가 정해져 있으면 `h-full`). `cn`은 클래스를 합치지 않으므로 `absolute`를 넘기면
 * 기본 `relative`와 부딪혀 높이가 0이 된다.
 * three.js가 `window`/WebGL에 의존해서 effect 안에서 필요할 때만 불러온다
 * (`PanoramaViewer`와 같은 방식). 콜백은 최신 것을 ref로 넘겨서 무대를 다시 만들지 않는다.
 */
export function RoomStageCanvas({
  imageUrl,
  state,
  view,
  pickMode = "none",
  furnitureEditable = false,
  placingType = null,
  furniture = NO_FURNITURE,
  selectedFurniture = null,
  className,
  ...callbacks
}: {
  /** 벽에 입힐 360° 사진. 도면 방은 null(사진 없이 그린다). */
  imageUrl: string | null;
  state: RoomStageState;
  view: RoomView;
  pickMode?: PickMode;
  furnitureEditable?: boolean;
  placingType?: string | null;
  furniture?: readonly StageFurniture[];
  selectedFurniture?: number | null;
  className?: string;
} & RoomStageCallbacks) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<RoomStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(imageUrl !== null);

  const callbacksRef = useRef<RoomStageCallbacks>(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let created: RoomStage | null = null;
    let cancelled = false;

    Promise.all([import("three"), import("three/examples/jsm/controls/OrbitControls.js"), import("../lib/stage")])
      .then(([three, { OrbitControls }, { RoomStage }]) => {
        if (cancelled) return;
        created = new RoomStage(three, OrbitControls, container, {
          onCornersChange: (corners) => callbacksRef.current.onCornersChange?.(corners),
          onCeilingPick: (uv) => callbacksRef.current.onCeilingPick?.(uv),
          onHint: (message) => callbacksRef.current.onHint?.(message),
          onFurnitureSelect: (index) => callbacksRef.current.onFurnitureSelect?.(index),
          onFurnitureMove: (index, x, z) => callbacksRef.current.onFurnitureMove?.(index, x, z),
          onFurnitureDragEnd: () => callbacksRef.current.onFurnitureDragEnd?.(),
          onPlace: (x, z) => callbacksRef.current.onPlace?.(x, z),
        });
        setStage(created);
      })
      .catch(() => {
        if (!cancelled) setError("3D 화면을 불러오지 못했어요. 브라우저가 WebGL을 지원하는지 확인해 주세요.");
      });

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!stage || !imageUrl) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
    });
    stage.setImage(imageUrl)
      .then(() => !cancelled && setLoading(false))
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setError(LOAD_ERROR_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, [stage, imageUrl]);

  useEffect(() => {
    if (!stage) return;
    stage.setState(state);
    // 높이가 바뀌면 가구 높이도 맞춰야 해서 다시 놓는다
    stage.setFurniture(furniture, selectedFurniture);
  }, [stage, state]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    stage?.setFurniture(furniture, selectedFurniture);
  }, [stage, furniture, selectedFurniture]);

  useEffect(() => {
    stage?.setView(view);
  }, [stage, view]);

  useEffect(() => {
    stage?.setPickMode(pickMode);
  }, [stage, pickMode]);

  useEffect(() => {
    stage?.setFurnitureEditable(furnitureEditable);
  }, [stage, furnitureEditable]);

  useEffect(() => {
    stage?.setPlacing(placingType);
  }, [stage, placingType]);

  return (
    <div className={cn("relative overflow-hidden bg-[#2a2e31]", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {(loading || error) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white">
          {error ?? "360° 사진을 불러오는 중…"}
        </div>
      )}
    </div>
  );
}
