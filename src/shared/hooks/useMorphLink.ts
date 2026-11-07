"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";

/** 데이터를 기다리는 최대 시간 — 이보다 늦으면 애니메이션 없이라도 바로 이동한다. */
const MAX_WAIT_MS = 700;

/** 카드로 이동하는 중인지 — 상세 히어로가 그려질 때 한 번 맨 위로 올리고 지운다(`useMorphArrival`). */
let morphPending = false;

/**
 * 목록 카드 → 상세로 "카드가 커지며 이어지는" 이동(React `<ViewTransition>` 공유 요소 전환)을 위한 Link 핸들러.
 *
 * 공유 요소 전환은 상세 화면이 이동하는 바로 그 순간 그려져야 짝이 맞는다. 상세는 데이터를 받아
 * 그리므로 카드에 마우스를 올리거나 포커스할 때 미리 받아 두고(`preload`), 눌렀을 때도 아직이면
 * 잠깐(최대 `MAX_WAIT_MS`) 기다렸다가 이동한다. 새 탭 열기(⌘/Ctrl 클릭 등)는 `onNavigate`가
 * 불리지 않아 평소처럼 동작한다.
 *
 * @param preload 상세가 쓰는 쿼리를 캐시에 채우는 함수 — 같은 키로 `ensureQueryData`를 쓰면 여러 번 불러도 한 번만 받는다.
 */
export function useMorphLink(href: string, preload: () => Promise<unknown>) {
  const router = useRouter();
  const warm = () => void preload().catch(() => undefined);

  return {
    onPointerEnter: warm,
    onFocus: warm,
    onNavigate: (event: { preventDefault: () => void }) => {
      event.preventDefault();
      const timeout = new Promise((resolve) => window.setTimeout(resolve, MAX_WAIT_MS));
      void Promise.race([preload().catch(() => undefined), timeout]).then(() => {
        morphPending = true;
        router.push(href);
      });
    },
  };
}

/**
 * 상세 히어로에서 부른다. 카드로 들어왔으면 그려지는 바로 그 순간(전환의 새 화면을 찍기 전) 맨 위로 올린다.
 * 안 그러면 랜딩에서 스크롤한 위치 그대로 그려져서 히어로가 화면 밖에 있고, 카드가 커지는 대신
 * 위로 사라지는 것처럼 보인다(Next의 맨 위 이동은 전환이 끝난 뒤에 일어난다).
 * 뒤로 가기 등 다른 이동에서는 아무것도 하지 않아 스크롤 위치 복원을 방해하지 않는다.
 */
export function useMorphArrival() {
  useLayoutEffect(() => {
    if (!morphPending) return;
    morphPending = false;
    // 전역 `scroll-behavior: smooth` 때문에 기본값이면 천천히 올라가며 전환 위치가 어긋난다 — 즉시 올린다.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
}

/** 카드와 상세 히어로가 같은 이름을 써야 이어진다. */
export const spaceMorphName = (spaceId: number) => `space-hero-${spaceId}`;
export const popupMorphName = (popupId: number) => `popup-hero-${popupId}`;
