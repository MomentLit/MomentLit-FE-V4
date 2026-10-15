import { loadKakaoMaps } from "./kakao-loader";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** 카카오맵 JS SDK의 주소 검색(지오코딩)을 브라우저에서 바로 호출한다 — REST API 키 없이 JS 키 하나로 동작한다. 주소를 못 찾으면 null. */
export async function geocodeAddress(address: string, signal: AbortSignal): Promise<Coordinates | null> {
  const kakao = await loadKakaoMaps();
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");

  return new Promise((resolve, reject) => {
    const geocoder = new kakao.services.Geocoder();
    const onAbort = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
    geocoder.addressSearch(address, (result, status) => {
      signal.removeEventListener("abort", onAbort);
      if (status === kakao.services.Status.ZERO_RESULT) {
        resolve(null);
        return;
      }
      if (status !== kakao.services.Status.OK || !result[0]) {
        reject(new Error("위치를 불러오지 못했어요. 다시 시도해 주세요."));
        return;
      }
      const longitude = Number(result[0].x);
      const latitude = Number(result[0].y);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        reject(new Error("위치를 불러오지 못했어요. 다시 시도해 주세요."));
        return;
      }
      resolve({ latitude, longitude });
    });
  });
}

/** 두 좌표 사이의 직선(대권) 거리(km). */
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
