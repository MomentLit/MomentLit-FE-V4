"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib";
import type { Vec2 } from "../lib/geometry";
import type { PickMode, RoomStage, RoomStageCallbacks, RoomStageState, RoomView } from "../lib/stage";

const LOAD_ERROR_MESSAGE = "360° 사진을 불러오지 못했어요.";

/**
 * `RoomStage`(three.js)를 감싸는 캔버스. three.js가 `window`/WebGL에 의존해서 effect 안에서 필요할 때만 불러온다
 * (`PanoramaViewer`와 같은 방식).
 */
export function RoomStageCanvas({
  imageUrl,
  state,
  view,
  pickMode,
  onCornersChange,
  onCeilingPick,
  onHint,
  className,
}: {
  imageUrl: string;
  state: RoomStageState;
  view: RoomView;
  pickMode: PickMode;
  onCornersChange?: (corners: Vec2[]) => void;
  onCeilingPick?: (uv: Vec2) => void;
  onHint?: (message: string) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<RoomStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 무대는 한 번만 만들고, 콜백은 최신 것을 ref로 넘긴다.
  const callbacksRef = useRef<RoomStageCallbacks>({});
  useEffect(() => {
    callbacksRef.current = { onCornersChange, onCeilingPick, onHint };
  }, [onCornersChange, onCeilingPick, onHint]);

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
        });
        setStage(created);
      })
      .catch(() => {
        if (!cancelled) setError("3D 화면을 불러오지 못했어요. 브라우저가 WebGL을 지원하는지 확인해 주세요.");
      });

    return () => {
      cancelled = true;
      created?.dispose();
      setStage(null);
    };
  }, []);

  useEffect(() => {
    if (!stage) return;
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
    stage?.setState(state);
  }, [stage, state]);

  useEffect(() => {
    stage?.setView(view);
  }, [stage, view]);

  useEffect(() => {
    stage?.setPickMode(pickMode);
  }, [stage, pickMode]);

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
