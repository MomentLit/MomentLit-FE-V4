"use client";

import { useEffect, useRef, useState } from "react";
import Map from "ol/Map.js";
import View from "ol/View.js";
import Feature from "ol/Feature.js";
import Point from "ol/geom/Point.js";
import TileLayer from "ol/layer/Tile.js";
import VectorLayer from "ol/layer/Vector.js";
import VectorSource from "ol/source/Vector.js";
import ImageTile from "ol/source/ImageTile.js";
import { fromLonLat } from "ol/proj.js";
import { Style, Circle, Fill, Stroke, Text } from "ol/style.js";
import "ol/ol.css";
import type { SpacePin } from "./model";

export default function MapCanvas({ pins, selectedId, onSelect }: {
  pins: SpacePin[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const target = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef<VectorSource | null>(null);
  const onSelectRef = useRef(onSelect);
  const [tileError, setTileError] = useState(false);
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!target.current) return;
    const key = process.env.NEXT_PUBLIC_VWORLD_API_KEY;
    if (!key) return;
    const tiles = new ImageTile({
      url: `https://api.vworld.kr/req/wmts/1.0.0/${encodeURIComponent(key)}/Base/{z}/{y}/{x}.png`,
      minZoom: 6, maxZoom: 19,
      attributions: '<a href="https://www.vworld.kr" target="_blank" rel="noopener noreferrer">공간정보 오픈플랫폼(브이월드)</a>',
      attributionsCollapsible: false,
    });
    tiles.on("tileloaderror", () => setTileError(true));
    tiles.on("tileloadend", () => setTileError(false));
    const source = new VectorSource();
    sourceRef.current = source;
    const map = new Map({
      target: target.current,
      layers: [new TileLayer({ source: tiles }), new VectorLayer({ source })],
      view: new View({ center: fromLonLat([127.5, 36.3]), zoom: 7, minZoom: 6, maxZoom: 19 }),
    });
    map.on("singleclick", (event) => {
      const feature = map.forEachFeatureAtPixel(event.pixel, (item) => item);
      const id = feature?.get("spaceId");
      if (typeof id === "number") onSelectRef.current(id);
    });
    map.on("pointermove", (event) => {
      map.getTargetElement().style.cursor = map.hasFeatureAtPixel(event.pixel) ? "pointer" : "grab";
    });
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.updateSize());
    observer.observe(target.current);
    return () => {
      observer.disconnect();
      map.setTarget(undefined);
      map.dispose();
      mapRef.current = null;
      sourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const source = sourceRef.current;
    const map = mapRef.current;
    if (!source || !map) return;
    source.clear();
    source.addFeatures(pins.map((pin) => {
      const selected = pin.space.space_id === selectedId;
      const feature = new Feature({ geometry: new Point(fromLonLat([pin.longitude, pin.latitude])), spaceId: pin.space.space_id });
      feature.setStyle(new Style({
        image: new Circle({ radius: selected ? 11 : 8, fill: new Fill({ color: selected ? "#ffd52e" : "#5fc5fc" }), stroke: new Stroke({ color: "#15171c", width: 2 }) }),
        text: selected ? new Text({ text: pin.space.name, offsetY: -25, font: "bold 14px sans-serif", fill: new Fill({ color: "#15171c" }), stroke: new Stroke({ color: "white", width: 4 }) }) : undefined,
      }));
      return feature;
    }));
    const selected = pins.find((pin) => pin.space.space_id === selectedId);
    if (selected) map.getView().animate({ center: fromLonLat([selected.longitude, selected.latitude]), zoom: 15, duration: 350 });
    else if (pins.length > 0) {
      const extent = source.getExtent();
      if (extent) map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 14, duration: 350 });
    }
  }, [pins, selectedId]);

  return (
    <div className="relative min-w-0 overflow-hidden border border-line bg-wash">
      <div ref={target} tabIndex={0} aria-label="공간 위치 지도. 방향키로 이동하고 더하기와 빼기로 확대 또는 축소할 수 있습니다." className="h-[55dvh] min-h-[360px] w-full lg:h-[70dvh]" />
      {tileError && <p role="alert" className="absolute bottom-12 left-4 right-4 border border-line bg-white p-3 text-sm text-coral">지도를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
    </div>
  );
}
