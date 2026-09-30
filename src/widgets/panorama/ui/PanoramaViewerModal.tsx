"use client";

import "@photo-sphere-viewer/core/index.css";
import { useEffect, useRef, useState } from "react";
import { IconX } from "@tabler/icons-react";
import type { Viewer } from "@photo-sphere-viewer/core";
import { cn } from "@/shared/lib";

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
          panorama: src,
          navbar: ["zoom", "move", "fullscreen"],
          loadingTxt: "360° 사진을 불러오는 중…",
        });
        viewer.addEventListener("panorama-error", () => setError("360° 사진을 불러오지 못했어요."));
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
        <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white">
          {error}
        </p>
      )}
    </div>
  );
}

/** 공간 상세 페이지의 "360° 보기" — `AuthModal`과 같은 오버레이 위에 뷰어를 크게 띄운다. */
export function PanoramaViewerModal({ src, title, onClose }: { src: string; title: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} 360° 사진`}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0px_8px_24px_0px_rgba(53,65,80,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
              360° View
            </span>
            <p className="truncate text-[0.98rem] font-semibold text-ink">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 p-1.5 text-soft transition-colors hover:text-ink"
          >
            <IconX size={20} stroke={2} aria-hidden />
          </button>
        </div>
        <PanoramaViewer src={src} className="h-[min(70vh,640px)]" />
      </div>
    </div>
  );
}
