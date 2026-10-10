export interface KakaoLatLng {
  getLat(): number;
  getLng(): number;
}

export interface KakaoLatLngBounds {
  extend(latlng: KakaoLatLng): void;
}

export interface KakaoCustomOverlay {
  setMap(map: KakaoMap | null): void;
}

export interface KakaoMap {
  setCenter(latlng: KakaoLatLng): void;
  panTo(latlng: KakaoLatLng): void;
  setLevel(level: number, options?: { anchor?: KakaoLatLng }): void;
  setMaxLevel(level: number): void;
  setBounds(
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ): void;
  relayout(): void;
}

export interface KakaoGeocoderResult {
  x: string;
  y: string;
}

export type KakaoGeocoderStatus = "OK" | "ZERO_RESULT" | "ERROR";

export interface KakaoGeocoder {
  addressSearch(address: string, callback: (result: KakaoGeocoderResult[], status: KakaoGeocoderStatus) => void): void;
}

export interface KakaoMaps {
  load(callback: () => void): void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Map: new (container: HTMLElement, options: { center: KakaoLatLng; level: number }) => KakaoMap;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    yAnchor?: number;
    xAnchor?: number;
    zIndex?: number;
  }) => KakaoCustomOverlay;
  services: {
    Geocoder: new () => KakaoGeocoder;
    Status: { OK: "OK"; ZERO_RESULT: "ZERO_RESULT"; ERROR: "ERROR" };
  };
}

let loadPromise: Promise<KakaoMaps> | null = null;

/** 카카오맵 JS SDK를 한 번만 주입하고 캐시한다 — MapCanvas(렌더링)와 model.ts(지오코딩)가 같은 로드를 공유한다. */
export function loadKakaoMaps(): Promise<KakaoMaps> {
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("카카오맵은 브라우저에서만 불러올 수 있어요."));
      return;
    }
    const loaded = window.kakao?.maps;
    if (loaded) {
      loaded.load(() => resolve(loaded));
      return;
    }
    const key = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
    if (!key) {
      reject(new Error("카카오맵 API 키가 설정되지 않았어요."));
      return;
    }
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false&libraries=services`;
    script.async = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("카카오맵 스크립트를 불러오지 못했어요."));
    };
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        reject(new Error("카카오맵 스크립트를 불러오지 못했어요."));
        return;
      }
      maps.load(() => resolve(maps));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
