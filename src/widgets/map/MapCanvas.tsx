"use client";

import { useEffect, useRef, useState } from "react";
import { loadKakaoMaps, type KakaoCustomOverlay, type KakaoMap } from "./lib/kakao-loader";
import { buildMarkerContent } from "./lib/marker";
import type { SpacePin } from "./model";

const CENTER = { lat: 36.3, lng: 127.5 };
const DEFAULT_LEVEL = 13;
const MAX_LEVEL = 13;
const SELECTED_LEVEL = 3;
const USER_LEVEL = 6;

function buildUserLocationContent(): HTMLDivElement {
  const dot = document.createElement("div");
  dot.className = "pointer-events-none relative h-4 w-4";
  dot.setAttribute("aria-label", "내 위치");
  dot.innerHTML = `
    <span class="absolute inset-0 animate-ping rounded-full bg-main-d opacity-40"></span>
    <span class="absolute inset-0 rounded-full border-2 border-white bg-main-d shadow-md"></span>
  `;
  return dot;
}

export default function MapCanvas({ pins, selectedId, onSelect }: {
  pins: SpacePin[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const onSelectRef = useRef(onSelect);
  // 내 위치로 먼저 포커싱됐다면, 첫 공간 목록 도착 시 전체 핀에 맞추는 줌아웃을 건너뛴다.
  const userLocatedRef = useRef(false);
  const hasFitRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!target.current) return;
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let userOverlay: KakaoCustomOverlay | null = null;
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
        setMapReady(true);

        navigator.geolocation?.getCurrentPosition(
          ({ coords }) => {
            if (cancelled) return;
            const position = new kakao.LatLng(coords.latitude, coords.longitude);
            userOverlay = new kakao.CustomOverlay({ position, content: buildUserLocationContent(), xAnchor: 0.5, yAnchor: 0.5, zIndex: 0 });
            userOverlay.setMap(map);
            userLocatedRef.current = true;
            map.setLevel(USER_LEVEL);
            map.setCenter(position);
          },
          () => {},
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      })
      .catch(() => setMapError(true));
    return () => {
      cancelled = true;
      observer?.disconnect();
      userOverlay?.setMap(null);
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
        const skipFit = userLocatedRef.current && !hasFitRef.current;
        hasFitRef.current = true;
        if (skipFit) return;
        const bounds = new kakao.LatLngBounds();
        pins.forEach((pin) => bounds.extend(new kakao.LatLng(pin.latitude, pin.longitude)));
        map.setBounds(bounds, 60, 60, 60, 60);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [mapReady, pins, selectedId]);

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
