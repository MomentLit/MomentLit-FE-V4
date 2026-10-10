import type { SpaceListItem } from "@/entities/space";
import { loadKakaoMaps } from "./lib/kakao-loader";

export interface SpacePin {
  space: SpaceListItem;
  longitude: number;
  latitude: number;
}

/** 카카오맵 JS SDK의 주소 검색(지오코딩)을 브라우저에서 바로 호출한다 — REST API 키 없이 JS 키 하나로 동작한다. */
export async function locateSpace(space: SpaceListItem, signal: AbortSignal): Promise<SpacePin | null> {
  const address = space.address.road_address || space.address.jibun_address;
  if (!address) return null;
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
        reject(new Error("공간 위치를 불러오지 못했어요. 다시 시도해 주세요."));
        return;
      }
      const longitude = Number(result[0].x);
      const latitude = Number(result[0].y);
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        reject(new Error("공간 위치를 불러오지 못했어요. 다시 시도해 주세요."));
        return;
      }
      resolve({ space, longitude, latitude });
    });
  });
}
