"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import { IconArrowsMaximize, IconLayoutDistributeVertical, IconTrash } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import { centroid, polygonArea, signedArea, toPyeong, type Vec2 } from "../lib/geometry";
import {
  moveOuterVertex,
  removeOuterVertex,
  setInnerWallLength,
  setOuterWallLength,
  snapOuterVertex,
  splitInnerWall,
  splitOuterWall,
  type Segment,
} from "../lib/planEdit";

type Selection =
  | { kind: "outer"; index: number }
  | { kind: "inner"; index: number }
  | { kind: "vertex"; index: number }
  | null;

interface View {
  x: number;
  z: number;
  w: number;
  h: number;
}

export interface PlanShape {
  outer: Vec2[];
  inner: Segment[];
}

/** 화면에서 끌기·스냅 허용 거리(px). */
const SNAP_PX = 8;
const DRAG_THRESHOLD_PX = 4;
const TAPE = "#f2bc2e";

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

function fitView(outer: readonly Vec2[], aspect: number): View {
  if (outer.length === 0) return { x: -3, z: -3, w: 6, h: 6 / aspect };
  const xs = outer.map((p) => p[0]);
  const zs = outer.map((p) => p[1]);
  const pad = 1.2;
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minZ = Math.min(...zs) - pad;
  const maxZ = Math.max(...zs) + pad;
  let w = maxX - minX;
  let h = maxZ - minZ;
  // 화면 비율에 맞춰 넓은 쪽을 기준으로
  if (w / h > aspect) h = w / aspect;
  else w = h * aspect;
  return { x: (minX + maxX) / 2 - w / 2, z: (minZ + maxZ) / 2 - h / 2, w, h };
}

function wallLength(a: Vec2, b: Vec2) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/**
 * 2D 도면 편집기 — 위에서 본 방(미터)을 보며 수치를 직접 고친다.
 *  - 벽을 누르고 길이(mm)를 넣고 Enter: 그 벽이 정확히 그 길이가 된다(바깥벽은 이어진 직각 벽도 같이 밀림 — CAD의 늘이기).
 *    벽을 고른 채 숫자를 바로 치면 입력이 시작된다.
 *  - 꼭짓점 끌기(이웃 점과 수평·수직, 다른 점의 x·z에 자동으로 맞춤), Delete로 지우기(3개 미만 불가), 벽 가운데에 점 추가
 *  - 빈 곳을 끌면 화면 이동, 휠로 확대
 */
export function PlanEditor({
  outer,
  inner = [],
  onChange,
  ceilingHeight,
  className,
}: {
  outer: readonly Vec2[];
  inner?: readonly Segment[];
  onChange: (shape: PlanShape) => void;
  ceilingHeight?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(() => fitView(outer, 1.6));
  const [selection, setSelection] = useState<Selection>(null);
  const [lengthText, setLengthText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const pointerRef = useRef<{
    mode: "pan" | "vertex";
    index: number;
    startClient: Vec2;
    startView: View;
    moved: boolean;
  } | null>(null);

  // 처음 그릴 때 화면 비율에 맞춰 방이 꽉 차게
  const fit = useCallback(() => {
    const svg = svgRef.current;
    const aspect = svg && svg.clientHeight > 0 ? svg.clientWidth / svg.clientHeight : 1.6;
    setView(fitView(outer, aspect));
  }, [outer]);
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || outer.length === 0) return;
    fittedRef.current = true;
    queueMicrotask(fit);
  }, [fit, outer.length]);

  // 지우거나 되돌려서 선택한 것이 없어졌으면 선택을 푼다(렌더 중에 계산)
  const current: Selection = selection && (
    (selection.kind === "inner" ? selection.index < inner.length : selection.index < outer.length)
  ) ? selection : null;

  const pxPerMeter = () => {
    const svg = svgRef.current;
    return svg && svg.clientWidth > 0 ? svg.clientWidth / view.w : 40;
  };

  function toPlan(clientX: number, clientY: number): Vec2 | null {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return [point.x, point.y];
  }

  function emit(next: Partial<PlanShape>) {
    onChange({ outer: next.outer ?? outer.map((p) => [p[0], p[1]]), inner: next.inner ?? inner.map(([a, b]) => [[...a], [...b]]) });
  }

  function select(next: Selection) {
    setSelection(next);
    setLengthText(null);
    setMessage(null);
  }

  // 휠 확대 — passive가 아니어야 페이지가 같이 스크롤되지 않는다
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const matrix = svg!.getScreenCTM();
      if (!matrix) return;
      const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const k = Math.exp(event.deltaY * 0.0015);
      setView((v) => {
        const w = Math.max(1, Math.min(200, v.w * k));
        const s = w / v.w;
        return { x: p.x - (p.x - v.x) * s, z: p.y - (p.y - v.z) * s, w, h: v.h * s };
      });
    }
    svg.addEventListener("wheel", handleWheel, { passive: false });
    return () => svg.removeEventListener("wheel", handleWheel);
  }, []);

  function handleBackgroundDown(event: PointerEvent<SVGSVGElement>) {
    pointerRef.current = {
      mode: "pan",
      index: -1,
      startClient: [event.clientX, event.clientY],
      startView: view,
      moved: false,
    };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function handleVertexDown(event: PointerEvent<SVGCircleElement>, index: number) {
    event.stopPropagation();
    select({ kind: "vertex", index });
    pointerRef.current = { mode: "vertex", index, startClient: [event.clientX, event.clientY], startView: view, moved: false };
    svgRef.current?.setPointerCapture(event.pointerId);
  }

  function handleWallDown(event: PointerEvent<SVGLineElement>, next: Selection) {
    event.stopPropagation();
    select(next);
  }

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const pointer = pointerRef.current;
    if (!pointer) return;
    const dx = event.clientX - pointer.startClient[0];
    const dy = event.clientY - pointer.startClient[1];
    if (!pointer.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    pointer.moved = true;

    if (pointer.mode === "pan") {
      const k = pointer.startView.w / (svgRef.current?.clientWidth || 1);
      setView({ ...pointer.startView, x: pointer.startView.x - dx * k, z: pointer.startView.z - dy * k });
      return;
    }
    const p = toPlan(event.clientX, event.clientY);
    if (!p) return;
    const snapped = snapOuterVertex(outer, pointer.index, p, SNAP_PX / pxPerMeter());
    emit({ outer: moveOuterVertex(outer, pointer.index, snapped) });
  }

  function handleUp() {
    const pointer = pointerRef.current;
    pointerRef.current = null;
    // 빈 곳을 눌렀다 바로 떼면 선택을 푼다
    if (pointer?.mode === "pan" && !pointer.moved) select(null);
  }

  // ---------- 선택한 것 고치기 ----------

  const selectedEnds: [Vec2, Vec2] | null = current?.kind === "outer"
    ? [outer[current.index], outer[(current.index + 1) % outer.length]]
    : current?.kind === "inner"
      ? [inner[current.index][0], inner[current.index][1]]
      : null;
  const selectedLengthMm = selectedEnds ? Math.round(wallLength(selectedEnds[0], selectedEnds[1]) * 1000) : null;

  function applyLength() {
    if (!current || current.kind === "vertex" || lengthText === null) return;
    const mm = Math.round(Number(lengthText));
    setLengthText(null);
    if (!(mm >= 100 && mm <= 100_000)) {
      setMessage("벽 길이는 100~100,000mm로 넣어 주세요.");
      return;
    }
    if (current.kind === "outer") emit({ outer: setOuterWallLength(outer, current.index, mm / 1000) });
    else emit({ inner: setInnerWallLength(inner, current.index, mm / 1000) });
    setMessage(`벽 길이를 ${mm.toLocaleString()}mm로 바꿨어요.`);
  }

  function handleLengthKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyLength();
      lengthInputRef.current?.blur();
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setLengthText(null);
      lengthInputRef.current?.blur();
    }
  }

  function deleteSelected() {
    if (!current) return;
    if (current.kind === "vertex") {
      const next = removeOuterVertex(outer, current.index);
      if (!next) {
        setMessage("바깥벽 점은 3개보다 줄일 수 없어요.");
        return;
      }
      emit({ outer: next });
      select(null);
    } else if (current.kind === "inner") {
      emit({ inner: inner.filter((_, i) => i !== current.index) });
      select(null);
    } else {
      setMessage("바깥벽은 지울 수 없어요. 양 끝 점을 지우거나 끌어서 고쳐 주세요.");
    }
  }

  function splitSelected() {
    if (!current || current.kind === "vertex") return;
    if (current.kind === "outer") {
      const { outer: next, vertex } = splitOuterWall(outer, current.index);
      emit({ outer: next });
      select({ kind: "vertex", index: vertex });
    } else {
      emit({ inner: splitInnerWall(inner, current.index) });
    }
  }

  // 키보드 — 벽을 고른 채 숫자를 치면 길이 입력으로, Delete 지우기, Esc 선택 풀기.
  // 리스너는 한 번만 달고 최신 선택·지우기는 ref로 읽는다.
  const keyStateRef = useRef({ current, deleteSelected });
  useEffect(() => {
    keyStateRef.current = { current, deleteSelected };
  });
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { current, deleteSelected } = keyStateRef.current;
      if (!current || isTypingTarget(event.target)) return;
      if (/^[0-9]$/.test(event.key) && current.kind !== "vertex") {
        event.preventDefault();
        setLengthText(event.key);
        lengthInputRef.current?.focus();
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (event.key === "Escape") {
        // 창(모달)이 닫히기 전에 선택부터 푼다
        event.stopPropagation();
        select(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // ---------- 그리기 ----------

  const unit = view.w / 60; // 화면 크기에 비례하는 글자·점 크기
  const outward = signedArea(outer) > 0 ? 1 : -1;
  const area = outer.length >= 3 ? polygonArea(outer) : 0;
  const [cx, cz] = outer.length > 0 ? centroid(outer) : [0, 0];
  const gridStep = view.w > 60 ? 5 : 1;
  const gridX: number[] = [];
  for (let x = Math.ceil(view.x / gridStep) * gridStep; x <= view.x + view.w; x += gridStep) gridX.push(x);
  const gridZ: number[] = [];
  for (let z = Math.ceil(view.z / gridStep) * gridStep; z <= view.z + view.h; z += gridStep) gridZ.push(z);

  const selectionTitle = !current
    ? null
    : current.kind === "vertex"
      ? `꼭짓점 ${current.index + 1}`
      : current.kind === "outer"
        ? `바깥벽 ${current.index + 1}–${(current.index + 1) % outer.length + 1}`
        : "안쪽 벽";

  return (
    <div className={cn("flex flex-col bg-white", className)}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className="min-h-0 flex-1 touch-none select-none text-ink"
        onPointerDown={handleBackgroundDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        role="img"
        aria-label={`도면 편집 — 면적 ${area.toFixed(1)}㎡`}
      >
        <g stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke">
          {gridX.map((x) => <line key={`gx${x}`} x1={x} y1={view.z} x2={x} y2={view.z + view.h} vectorEffect="non-scaling-stroke" />)}
          {gridZ.map((z) => <line key={`gz${z}`} x1={view.x} y1={z} x2={view.x + view.w} y2={z} vectorEffect="non-scaling-stroke" />)}
        </g>

        {outer.length >= 3 && (
          <polygon
            points={outer.map((p) => p.join(",")).join(" ")}
            fill="var(--wash, #f4f4f2)"
            stroke="currentColor"
            strokeWidth={5}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* 바깥벽 — 눌러서 고르기(보이지 않는 굵은 선으로 누르기 쉽게) */}
        {outer.map((a, i) => {
          const b = outer[(i + 1) % outer.length];
          const selected = current?.kind === "outer" && current.index === i;
          return (
            <g key={`wall-${i}`}>
              {selected && (
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={TAPE} strokeWidth={7} vectorEffect="non-scaling-stroke" />
              )}
              <line
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="transparent"
                strokeWidth={18}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onPointerDown={(event) => handleWallDown(event, { kind: "outer", index: i })}
              />
            </g>
          );
        })}

        {inner.map(([a, b], i) => {
          const selected = current?.kind === "inner" && current.index === i;
          return (
            <g key={`inner-${i}`}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={selected ? TAPE : "currentColor"} strokeWidth={4} vectorEffect="non-scaling-stroke" />
              <line
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="transparent"
                strokeWidth={18}
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onPointerDown={(event) => handleWallDown(event, { kind: "inner", index: i })}
              />
            </g>
          );
        })}

        {/* 벽마다 바깥쪽 치수 */}
        {outer.length >= 3 && outer.map((a, i) => {
          const b = outer[(i + 1) % outer.length];
          const length = wallLength(a, b);
          if (length < 0.2) return null;
          const nx = ((b[1] - a[1]) / length) * outward;
          const nz = (-(b[0] - a[0]) / length) * outward;
          const tx = (a[0] + b[0]) / 2 + nx * unit * 2.2;
          const tz = (a[1] + b[1]) / 2 + nz * unit * 2.2;
          const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
          const selected = current?.kind === "outer" && current.index === i;
          return (
            <text
              key={`dim-${i}`}
              x={tx}
              y={tz}
              fontSize={unit * 1.4}
              fontWeight={selected ? 700 : 500}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={selected ? "#a37a00" : "currentColor"}
              transform={`rotate(${upright} ${tx} ${tz})`}
              pointerEvents="none"
            >
              {selected ? `${Math.round(length * 1000).toLocaleString()}mm` : `${length.toFixed(2)}m`}
            </text>
          );
        })}

        {outer.length >= 3 && (
          <g textAnchor="middle" fill="currentColor" opacity={0.6} pointerEvents="none">
            <text x={cx} y={cz} fontSize={unit * 2} fontWeight={700}>{area.toFixed(1)}㎡</text>
            <text x={cx} y={cz + unit * 2.2} fontSize={unit * 1.2}>
              약 {toPyeong(area).toFixed(1)}평{ceilingHeight ? ` · 천장 ${ceilingHeight.toFixed(2)}m` : ""}
            </text>
          </g>
        )}

        {/* 꼭짓점 — 끌어서 옮기기 */}
        {outer.map(([x, z], i) => {
          const selected = current?.kind === "vertex" && current.index === i;
          return (
            <circle
              key={`v-${i}`}
              cx={x}
              cy={z}
              r={unit * (selected ? 0.9 : 0.7)}
              fill={selected ? TAPE : "white"}
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="cursor-move"
              onPointerDown={(event) => handleVertexDown(event, i)}
            />
          );
        })}
      </svg>

      <div className="flex min-h-[64px] flex-wrap items-center gap-2 border-t border-line p-3">
        {current && selectionTitle ? (
          <>
            <span className="text-sm font-semibold text-ink">{selectionTitle}</span>
            {current.kind !== "vertex" && selectedLengthMm !== null && (
              <label className="flex items-center gap-2 text-sm text-ink">
                길이
                <input
                  ref={lengthInputRef}
                  type="number"
                  inputMode="numeric"
                  min={100}
                  step={10}
                  value={lengthText ?? String(selectedLengthMm)}
                  onChange={(event) => setLengthText(event.target.value)}
                  onBlur={applyLength}
                  onKeyDown={handleLengthKeyDown}
                  className={cn(fieldInputClass, "w-28 py-2")}
                  aria-label="벽 길이(mm)"
                />
                mm
              </label>
            )}
            {current.kind !== "vertex" && (
              <button type="button" onClick={splitSelected} className="button button--outline min-h-9 px-3 py-1.5">
                <IconLayoutDistributeVertical size={16} stroke={2} aria-hidden />
                가운데에 점 추가
              </button>
            )}
            {current.kind !== "outer" && (
              <button type="button" onClick={deleteSelected} className="button button--danger min-h-9 px-3 py-1.5">
                <IconTrash size={16} stroke={2} aria-hidden />
                지우기
              </button>
            )}
          </>
        ) : (
          <span className="text-sm text-soft">
            벽을 누르면 길이(mm)를 바로 고칠 수 있어요. 점은 끌어서 옮기고, 빈 곳을 끌면 화면이 움직여요.
          </span>
        )}
        <button type="button" onClick={fit} className="button button--outline ml-auto min-h-9 px-3 py-1.5">
          <IconArrowsMaximize size={16} stroke={2} aria-hidden />
          화면 맞춤
        </button>
        {message && <span className="w-full text-xs text-soft" aria-live="polite">{message}</span>}
      </div>
    </div>
  );
}

