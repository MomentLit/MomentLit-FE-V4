"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoCustomOverlay, type KakaoMap } from "./lib/kakao-loader";
import { buildMarkerContent } from "./lib/marker";
import type { SpacePin } from "./model";

const CENTER = { lat: 36.3, lng: 127.5 };
const DEFAULT_LEVEL = 13;
const MAX_LEVEL = 13;
const SELECTED_LEVEL = 3;

export default function MapCanvas({ pins, selectedId, onSelect }: {
  pins: SpacePin[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const onSelectRef = useRef(onSelect);
  const [mapError, setMapError] = useState(false);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!target.current) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !target.current) return;
        const map = new kakao.Map(target.current, {
          center: new kakao.LatLng(CENTER.lat, CENTER.lng),
          level: DEFAULT_LEVEL,
        });
        map.setMaxLevel(MAX_LEVEL);
        mapRef.current = map;
        observer = new ResizeObserver(() => map.relayout());
        observer.observe(target.current);
      })
      .catch(() => setMapError(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    loadKakaoMaps().then((kakao) => {
      if (cancelled) return;
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = pins.map((pin) => {
        const selected = pin.space.space_id === selectedId;
        const position = new kakao.LatLng(pin.latitude, pin.longitude);
        const content = buildMarkerContent(pin, selected, () => onSelectRef.current(pin.space.space_id));
        const overlay = new kakao.CustomOverlay({ position, content, yAnchor: 1, xAnchor: 0.5, zIndex: selected ? 2 : 1 });
        overlay.setMap(map);
        return overlay;
      });

      const selectedPin = pins.find((pin) => pin.space.space_id === selectedId);
      if (selectedPin) {
        const position = new kakao.LatLng(selectedPin.latitude, selectedPin.longitude);
        map.panTo(position);
        map.setLevel(SELECTED_LEVEL, { anchor: position });
      } else if (pins.length > 0) {
        const bounds = new kakao.LatLngBounds();
        pins.forEach((pin) => bounds.extend(new kakao.LatLng(pin.latitude, pin.longitude)));
        map.setBounds(bounds, 60, 60, 60, 60);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pins, selectedId]);

  return (
    <div className="relative min-w-0 overflow-hidden border border-line bg-wash">
      <div
        ref={target}
        tabIndex={0}
        aria-label="공간 위치 지도. 방향키로 이동하고 더하기와 빼기로 확대 또는 축소할 수 있습니다."
        className="h-[55dvh] min-h-[360px] w-full lg:h-[70dvh]"
      />
      {mapError && (
        <p role="alert" className="absolute bottom-12 left-4 right-4 border border-line bg-white p-3 text-sm text-coral">
          지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
