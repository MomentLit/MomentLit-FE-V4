"use client";

import { useId, useRef, type MouseEvent, type PointerEvent } from "react";
import { cn } from "@/shared/lib";
import { findFurniture } from "../lib/furniture";
import { centroid, pointInPolygon, polygonArea, signedArea, toPyeong, wallLengths, type Vec2 } from "../lib/geometry";
import type { StageFurniture } from "../lib/stage";
import type { PlanFloorImage } from "../planModel";

const PADDING_M = 1.2;
const DRAG_THRESHOLD_M = 0.03;

/**
 * 위에서 본 평면도(SVG, 단위 m). 1m 격자·축척 막대, 바깥벽과 바깥쪽 치수, 가운데 면적·천장 높이, 가구 실제 크기 윤곽.
 * 3D와 같은 좌표라 [x, z]를 그대로 SVG (x, y)로 쓴다. 여기서도 가구를 놓고·고르고·끌 수 있다.
 */
export function RoomPlanView({
  outer,
  inner,
  ceilingHeight,
  furniture,
  selected,
  placingType,
  onSelect,
  onMove,
  onDragEnd,
  onPlace,
  onHint,
  floorImage = null,
  className,
}: {
  outer: readonly Vec2[];
  inner: readonly (readonly [Vec2, Vec2])[];
  ceilingHeight: number;
  furniture: readonly StageFurniture[];
  selected: number | null;
  placingType: string | null;
  onSelect: (index: number | null) => void;
  onMove: (index: number, x: number, z: number) => void;
  onDragEnd: () => void;
  onPlace: (x: number, z: number) => void;
  onHint: (message: string) => void;
  /** 도면으로 만든 방이면 그 도면을 방 바닥 안쪽에 흐리게 깐다. */
  floorImage?: PlanFloorImage | null;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = useId();
  const dragRef = useRef<{ index: number; offset: Vec2; start: Vec2; moved: boolean } | null>(null);

  const xs = outer.map((p) => p[0]);
  const zs = outer.map((p) => p[1]);
  const minX = Math.floor(Math.min(...xs) - PADDING_M);
  const maxX = Math.ceil(Math.max(...xs) + PADDING_M);
  const minZ = Math.floor(Math.min(...zs) - PADDING_M);
  const maxZ = Math.ceil(Math.max(...zs) + PADDING_M);
  const width = maxX - minX;
  const height = maxZ - minZ;
  const area = polygonArea(outer);
  const [cx, cz] = centroid(outer);
  const lengths = wallLengths(outer);
  // 바깥쪽 법선 방향: 반시계(양수 면적)면 변의 오른쪽이 바깥
  const outward = signedArea(outer) > 0 ? 1 : -1;

  function toPlan(event: { clientX: number; clientY: number }): Vec2 | null {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }

  function handleFurnitureDown(event: PointerEvent<SVGGElement>, index: number) {
    if (placingType) return;
    event.stopPropagation();
    const point = toPlan(event);
    const item = furniture[index];
    onSelect(index);
    if (!point || !item) return;
    dragRef.current = { index, offset: [item.x - point[0], item.z - point[1]], start: point, moved: false };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = toPlan(event);
    if (!point) return;
    if (!drag.moved && Math.hypot(point[0] - drag.start[0], point[1] - drag.start[1]) < DRAG_THRESHOLD_M) return;
    drag.moved = true;
    const x = point[0] + drag.offset[0];
    const z = point[1] + drag.offset[1];
    if (pointInPolygon([x, z], outer)) onMove(drag.index, x, z);
  }

  function handleUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.moved) onDragEnd();
  }

  function handleBackgroundClick(event: MouseEvent<SVGSVGElement>) {
    if (dragRef.current) return;
    const point = toPlan(event);
    if (placingType) {
      if (point && pointInPolygon(point, outer)) onPlace(point[0], point[1]);
      else onHint("방 안쪽 바닥을 눌러 주세요.");
      return;
    }
    onSelect(null);
  }

  const gridX = Array.from({ length: width + 1 }, (_, i) => minX + i);
  const gridZ = Array.from({ length: height + 1 }, (_, i) => minZ + i);

  return (
    <svg
      ref={svgRef}
      viewBox={`${minX} ${minZ} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("touch-none select-none bg-white text-ink", placingType && "cursor-crosshair", className)}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      onClick={handleBackgroundClick}
      role="img"
      aria-label={`평면도 — 면적 ${area.toFixed(1)}㎡, 천장 ${ceilingHeight.toFixed(2)}m`}
    >
      {/* 1m 격자 */}
      <g stroke="var(--line)" strokeWidth={0.01}>
        {gridX.map((x) => <line key={`x${x}`} x1={x} y1={minZ} x2={x} y2={maxZ} />)}
        {gridZ.map((z) => <line key={`z${z}`} x1={minX} y1={z} x2={maxX} y2={z} />)}
      </g>

      {/* 바닥(도면 방이면 도면 이미지)과 바깥벽 */}
      {floorImage && (
        <>
          <clipPath id={clipId}>
            <polygon points={outer.map((p) => p.join(",")).join(" ")} />
          </clipPath>
          <image
            href={floorImage.url}
            x={floorImage.x}
            y={floorImage.z}
            width={floorImage.width}
            height={floorImage.height}
            preserveAspectRatio="none"
            opacity={0.55}
            clipPath={`url(#${clipId})`}
            pointerEvents="none"
          />
        </>
      )}
      <polygon points={outer.map((p) => p.join(",")).join(" ")} fill={floorImage ? "none" : "var(--wash, #f4f4f2)"} stroke="currentColor" strokeWidth={0.12} strokeLinejoin="miter" />
      {inner.map(([a, b], i) => (
        <line key={`inner-${i}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="currentColor" strokeWidth={0.1} strokeLinecap="square" />
      ))}

      {/* 벽마다 바깥쪽 치수 */}
      {outer.map((a, i) => {
        const b = outer[(i + 1) % outer.length];
        const length = lengths[i];
        if (length < 0.3) return null;
        const nx = ((b[1] - a[1]) / length) * outward;
        const nz = (-(b[0] - a[0]) / length) * outward;
        const offset = 0.45;
        const ax = a[0] + nx * offset;
        const az = a[1] + nz * offset;
        const bx = b[0] + nx * offset;
        const bz = b[1] + nz * offset;
        const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
        const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
        return (
          <g key={`dim-${i}`} stroke="currentColor" strokeWidth={0.015} opacity={0.75}>
            <line x1={ax} y1={az} x2={bx} y2={bz} />
            <line x1={a[0] + nx * 0.2} y1={a[1] + nz * 0.2} x2={a[0] + nx * 0.55} y2={a[1] + nz * 0.55} />
            <line x1={b[0] + nx * 0.2} y1={b[1] + nz * 0.2} x2={b[0] + nx * 0.55} y2={b[1] + nz * 0.55} />
            <text
              x={(ax + bx) / 2 + nx * 0.18}
              y={(az + bz) / 2 + nz * 0.18}
              fontSize={0.22}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="currentColor"
              stroke="none"
              transform={`rotate(${upright} ${(ax + bx) / 2 + nx * 0.18} ${(az + bz) / 2 + nz * 0.18})`}
            >
              {length.toFixed(2)}m
            </text>
          </g>
        );
      })}

      {/* 가운데 면적·천장 */}
      <g textAnchor="middle" fill="currentColor" opacity={0.6} pointerEvents="none">
        <text x={cx} y={cz - 0.05} fontSize={0.34} fontWeight={700}>{area.toFixed(1)}㎡</text>
        <text x={cx} y={cz + 0.3} fontSize={0.2}>약 {toPyeong(area).toFixed(1)}평 · 천장 {ceilingHeight.toFixed(2)}m</text>
      </g>

      {/* 가구 */}
      {furniture.map((item, index) => {
        const def = findFurniture(item.type);
        if (!def) return null;
        const isSelected = index === selected;
        return (
          <g
            key={`${item.type}-${index}`}
            transform={`translate(${item.x} ${item.z}) rotate(${(-item.rotation * 180) / Math.PI})`}
            onPointerDown={(event) => handleFurnitureDown(event, index)}
            onClick={(event) => event.stopPropagation()}
            className={placingType ? undefined : "cursor-move"}
          >
            <rect
              x={-def.width / 2}
              y={-def.depth / 2}
              width={def.width}
              height={def.depth}
              fill={isSelected ? "#f2bc2e55" : "#ffffffcc"}
              stroke={isSelected ? "#c99a12" : "currentColor"}
              strokeWidth={isSelected ? 0.05 : 0.025}
              // 천장에 단 가구는 위에서 본 바닥 위에 떠 있으니 점선
              strokeDasharray={def.mount === "ceiling" ? "0.08 0.06" : undefined}
            />
            <text fontSize={Math.min(0.18, def.width / 4)} textAnchor="middle" dominantBaseline="middle" fill="currentColor" pointerEvents="none">
              {def.name}
            </text>
          </g>
        );
      })}

      {/* 축척 막대 1m */}
      <g transform={`translate(${minX + 0.4} ${maxZ - 0.4})`} stroke="currentColor" strokeWidth={0.03} pointerEvents="none">
        <line x1={0} y1={0} x2={1} y2={0} />
        <line x1={0} y1={-0.08} x2={0} y2={0.08} />
        <line x1={1} y1={-0.08} x2={1} y2={0.08} />
        <text x={0.5} y={-0.14} fontSize={0.18} textAnchor="middle" fill="currentColor" stroke="none">1m</text>
      </g>
    </svg>
  );
}
