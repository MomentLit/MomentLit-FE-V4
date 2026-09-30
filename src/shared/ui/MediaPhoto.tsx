"use client";

import { useState } from "react";

/** Host-uploaded remote images, with an explicit failure state. */
export function MediaPhoto({ src, alt, className = "" }: { src: string | null; alt: string; className?: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return <div className={`grid place-items-center bg-violet p-4 text-sm font-bold text-ink ${className}`} role="img" aria-label={alt}>{src ? "사진을 불러올 수 없어요" : "사진 준비 중"}</div>;
  }
  // eslint-disable-next-line @next/next/no-img-element -- arbitrary host-uploaded URLs loaded directly
  return <img src={src} alt={alt} decoding="async" className={className} onError={() => setFailedSrc(src)} />;
}
