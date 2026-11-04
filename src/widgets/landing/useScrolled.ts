"use client";

import { useEffect, useState } from "react";

/** 페이지가 맨 위에서 `threshold`px 넘게 내려왔는지. 랜딩 헤더가 맨 위에선 버튼만, 스크롤하면 바를 보이게 쓴다. */
export function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [threshold]);

  return scrolled;
}
