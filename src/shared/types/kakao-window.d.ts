import type { KakaoMaps } from "@/widgets/map/lib/kakao-loader";

/**
 * 카카오맵 JS SDK(`maps`)와 다음 우편번호 위젯(`Postcode`)이 둘 다 같은
 * `window.kakao` 전역을 쓴다 — 두 선언이 따로 있으면 "같은 타입이어야 한다"는
 * 에러가 나서 한 곳에 합쳐둔다.
 */
declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMaps;
      Postcode?: new (options: {
        oncomplete: (result: {
          roadAddress: string;
          sido: string;
          sigungu: string;
          bname: string;
          bname1: string;
          bname2: string;
          zonecode: string;
        }) => void;
        shorthand?: boolean;
        width?: string;
        height?: string;
      }) => { embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void };
    };
  }
}

export {};
