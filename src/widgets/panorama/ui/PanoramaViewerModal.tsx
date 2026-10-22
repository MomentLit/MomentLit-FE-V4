"use client";

import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import type { Viewer } from "@photo-sphere-viewer/core";
import { cn } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";
import { toVirtualTourNodes, type PanoramaTourScene } from "../model";

const LOAD_ERROR_MESSAGE = "360° 사진을 불러오지 못했어요.";

/**
 * 등장방형(2:1) 360도 사진 뷰어 — 드래그/스와이프로 둘러보고 확대·전체화면을 지원한다.
 * 라이브러리가 `window`/WebGL에 의존해서 effect 안에서 필요할 때만 불러온다.
 *
 * `scenes`가 2장 이상이면 로드뷰처럼 바닥 화살표를 눌러 장면마다 지정한 방향의 다른 장면으로 이동한다(`toVirtualTourNodes`).
 * 1장이거나 `src`만 넘기면 기존처럼 사진 한 장만 보여준다.
 */
export function PanoramaViewer({ src, scenes, className }: {
  src?: string;
  scenes?: readonly PanoramaTourScene[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 부모가 렌더마다 새 배열을 넘겨도 뷰어를 다시 만들지 않도록, 내용이 같으면 같은 키가 되게 한다.
  const scenesKey = JSON.stringify(scenes ?? (src ? [{ image_url: src }] : []));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const tourScenes: PanoramaTourScene[] = JSON.parse(scenesKey);
    if (tourScenes.length === 0) return;

    let viewer: Viewer | null = null;
    let cancelled = false;
    queueMicrotask(() => setError(null));

    if (tourScenes.length === 1) {
      import("@photo-sphere-viewer/core")
        .then(({ Viewer }) => {
          if (cancelled) return;
          viewer = new Viewer({
            container,
            navbar: ["zoom", "move", "fullscreen"],
            loadingTxt: "360° 사진을 불러오는 중…",
          });
          // 생성자에 panorama를 넘기면 불러오기 실패(CORS 등)가 처리되지 않은 Promise로 새어 나간다 — 직접 받아서 처리한다.
          // 실패하면 라이브러리의 영문 오류 화면 대신 우리 안내 문구가 보이도록 뷰어를 닫는다.
          viewer.setPanorama(tourScenes[0].image_url).catch(() => {
            if (cancelled) return;
            viewer?.destroy();
            viewer = null;
            setError(LOAD_ERROR_MESSAGE);
          });
        })
        .catch(() => {
          if (!cancelled) setError("360° 뷰어를 불러오지 못했어요.");
        });
    } else {
      Promise.all([import("@photo-sphere-viewer/core"), import("@photo-sphere-viewer/virtual-tour-plugin")])
        .then(([{ Viewer }, { VirtualTourPlugin }]) => {
          if (cancelled) return;
          viewer = new Viewer({
            container,
            navbar: ["zoom", "move", "fullscreen"],
            loadingTxt: "360° 사진을 불러오는 중…",
            // 장면을 불러오지 못하면 플러그인이 뷰어 위에 이 문구를 띄운다(다른 장면으로는 계속 이동할 수 있다).
            lang: { loadError: LOAD_ERROR_MESSAGE },
            plugins: [
              VirtualTourPlugin.withConfig({
                positionMode: "manual",
                renderMode: "3d",
                // 전환 효과·회전 없이 바로 다음 장면을 보여준다.
                transitionOptions: { showLoader: true, effect: "none", rotation: false },
              }),
            ],
          });

          const tour = viewer.getPlugin<InstanceType<typeof VirtualTourPlugin>>(VirtualTourPlugin);
          // 화살표 클릭 등 플러그인 내부에서 부르는 장면 전환은 불러오기에 실패하면(오류 문구는 띄운 뒤)
          // 처리되지 않은 Promise로 새어 나간다 — 여기서 받아서 삼킨다. 노드를 넣기 전에 감싸야 첫 장면도 포함된다.
          const setCurrentNode = tour.setCurrentNode.bind(tour);
          tour.setCurrentNode = (...args) => setCurrentNode(...args).catch(() => false);
          tour.setNodes(toVirtualTourNodes(tourScenes));
        })
        .catch(() => {
          if (!cancelled) setError("360° 뷰어를 불러오지 못했어요.");
        });
    }

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [scenesKey]);

  return (
    <div className={cn("relative overflow-hidden bg-ink", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {error && (
        <p role="alert" className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white">
          {error}
        </p>
      )}
    </div>
  );
}

/** 공간 상세 페이지의 "360° 보기" — `AuthModal`과 같은 오버레이 위에 뷰어를 크게 띄운다. 장면이 여러 장이면 이동할 수 있다. */
export function PanoramaViewerModal({ scenes, title, onClose }: {
  scenes: readonly PanoramaTourScene[];
  title: string;
  onClose: () => void;
}) {
  return (
    <Modal label={`${title} 360° 사진`} onClose={onClose} panelClassName="flex w-full max-w-[1100px] flex-col overflow-y-auto border border-line bg-white">
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0">
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">360° View</span>
          <h2 className="truncate section-title text-ink">{title}</h2>
        </div>
        <button type="button" onClick={onClose} className="button button--outline shrink-0">
          <IconX size={18} stroke={2} aria-hidden />
          닫기
        </button>
      </div>
      <PanoramaViewer scenes={scenes} className="h-[min(65dvh,640px)] shrink-0" />
    </Modal>
  );
}
