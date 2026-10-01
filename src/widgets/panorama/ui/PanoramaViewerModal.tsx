"use client";

import "@photo-sphere-viewer/core/index.css";
import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import type { Viewer } from "@photo-sphere-viewer/core";
import { cn } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";

/**
 * 등장방형(2:1) 360도 사진 뷰어 — 드래그/스와이프로 둘러보고 확대·전체화면을 지원한다.
 * 라이브러리가 `window`/WebGL에 의존해서 effect 안에서 필요할 때만 불러온다.
 */
export function PanoramaViewer({ src, className }: { src: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let viewer: Viewer | null = null;
    let cancelled = false;
    queueMicrotask(() => setError(null));

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
        viewer.setPanorama(src).catch(() => {
          if (cancelled) return;
          viewer?.destroy();
          viewer = null;
          setError("360° 사진을 불러오지 못했어요.");
        });
      })
      .catch(() => {
        if (!cancelled) setError("360° 뷰어를 불러오지 못했어요.");
      });

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [src]);

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

/** 공간 상세 페이지의 "360° 보기" — `AuthModal`과 같은 오버레이 위에 뷰어를 크게 띄운다. */
export function PanoramaViewerModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
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
      <PanoramaViewer src={src} className="h-[min(65dvh,640px)] shrink-0" />
    </Modal>
  );
}
