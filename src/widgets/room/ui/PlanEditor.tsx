"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from "react";
import { IconArrowsMaximize, IconLayoutDistributeVertical, IconTrash } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import { polygonArea, signedArea, toPyeong, type Vec2 } from "../lib/geometry";
import {
  moveOuterVertex,
  removeOuterVertex,
  setInnerWallLength,
  setOuterWallLength,
  snapOuterVertex,
  snapPoint,
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

/** 그리기 — 바깥벽 모서리 찍기 / 안쪽 벽 시작·끝 찍기 / 축척 기준 두 점 찍기. "none"이면 고르기·끌기. */
export type PlanDrawMode = "none" | "outer" | "inner" | "scale";

/** 바닥 평면(m)에 깔 도면 이미지. */
export interface PlanBackground {
  href: string;
  x: number;
  z: number;
  width: number;
  height: number;
}

/** 첫 점 근처를 누르면 바깥벽을 닫는다(px). */
const CLOSE_PX = 12;
/** 안쪽 벽 끝을 기존 점·바깥벽에 붙이는 거리(px). */
const STICK_PX = 12;

/** 화면에서 끌기·스냅 허용 거리(px). */
const SNAP_PX = 8;
const DRAG_THRESHOLD_PX = 4;
const TAPE = "#f2bc2e";

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

function fitView(outer: readonly Vec2[], aspect: number): View {
  if (outer.length === 0) return { x: -3, z: -3, w: 6, h: 6 / aspect };
  if (outer.length === 1) return { x: outer[0][0] - 3, z: outer[0][1] - 3, w: 6, h: 6 / aspect };
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
  closed = true,
  drawMode = "none",
  background = null,
  uncalibrated = false,
  onClose,
  onScaleLine,
  onCalibrate,
  className,
}: {
  outer: readonly Vec2[];
  inner?: readonly Segment[];
  onChange: (shape: PlanShape) => void;
  ceilingHeight?: number;
  /** 바깥벽이 닫혔는지 — 그리는 중이면 false(마지막 점과 첫 점 사이 벽이 없다). */
  closed?: boolean;
  drawMode?: PlanDrawMode;
  /** 밑에 깔 도면 이미지. */
  background?: PlanBackground | null;
  /** 축척을 아직 모르면 true — 벽 길이를 넣으면 그 벽을 늘이지 않고 도면 전체 축척을 맞춘다(`onCalibrate`). */
  uncalibrated?: boolean;
  /** 바깥벽 그리기에서 첫 점을 다시 눌렀을 때. */
  onClose?: () => void;
  /** 축척 재기에서 두 점을 찍었을 때. */
  onScaleLine?: (a: Vec2, b: Vec2) => void;
  /** 축척을 모를 때 벽 길이를 넣으면 — 지금 길이(m)와 실제 길이(m). */
  onCalibrate?: (current: number, actual: number) => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(() => fitView(outer, 1.6));
  const [selection, setSelection] = useState<Selection>(null);
  const [lengthText, setLengthText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // 그리는 중 — 안쪽 벽 시작점, 축척 두 점, 마우스 자리(미리보기 선)
  const [pending, setPending] = useState<Vec2 | null>(null);
  const [scalePoints, setScalePoints] = useState<Vec2[]>([]);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [lastDrawMode, setLastDrawMode] = useState(drawMode);
  if (lastDrawMode !== drawMode) {
    // 그리기 종류가 바뀌면 그리던 것을 비운다(렌더 중 상태 맞추기)
    setLastDrawMode(drawMode);
    setPending(null);
    setScalePoints([]);
    setSelection(null);
  }
  // 화면 폭(px) — 치수 글자가 벽 길이 안에 들어갈 때만 보여 주는 데 쓴다
  const [svgWidth, setSvgWidth] = useState(0);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => setSvgWidth(svg.clientWidth));
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
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
    // 바깥벽이 아직 없으면 도면 이미지 전체가 보이게
    const target: Vec2[] = outer.length >= 2 || !background
      ? outer.map((p) => [p[0], p[1]])
      : [[background.x, background.z], [background.x + background.width, background.z + background.height]];
    setView(fitView(target, aspect));
  }, [outer, background]);
  const fittedRef = useRef(false);
  useEffect(() => {
    if (fittedRef.current || (outer.length === 0 && !background)) return;
    fittedRef.current = true;
    queueMicrotask(fit);
  }, [fit, outer.length, background]);

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
    if (drawMode !== "none" && (!pointer || !pointer.moved)) {
      const p = toPlan(event.clientX, event.clientY);
      setHover(p ? snapForDraw(p) : null);
    }
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

  function handleUp(event: PointerEvent<SVGSVGElement>) {
    const pointer = pointerRef.current;
    pointerRef.current = null;
    if (pointer?.mode !== "pan" || pointer.moved) return;
    // 빈 곳을 눌렀다 바로 떼면 — 그리는 중이면 점 찍기, 아니면 선택 풀기
    if (drawMode === "none") {
      select(null);
      return;
    }
    const p = toPlan(event.clientX, event.clientY);
    if (p) handleDrawClick(p);
  }

  // ---------- 그리기 ----------

  /** 가장 가까운 바깥벽 위의 점(가까우면). */
  function nearestOnOuter(p: Vec2, tolerance: number): Vec2 | null {
    if (outer.length < 2) return null;
    let best: Vec2 | null = null;
    let bestDistance = tolerance;
    const count = closed ? outer.length : outer.length - 1;
    for (let i = 0; i < count; i++) {
      const a = outer[i];
      const b = outer[(i + 1) % outer.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
      const q: Vec2 = [a[0] + t * dx, a[1] + t * dz];
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bestDistance) {
        bestDistance = d;
        best = q;
      }
    }
    return best;
  }

  /** 그리기 종류에 맞춰 점을 맞춘다 — 수평·수직, 다른 점의 x·z, (안쪽 벽은) 기존 점·바깥벽에 붙이기. */
  function snapForDraw(p: Vec2): Vec2 {
    const tolerance = SNAP_PX / pxPerMeter();
    if (drawMode === "outer") {
      const last = outer.at(-1) ?? null;
      return snapPoint(p, last, outer.slice(0, -1), tolerance);
    }
    if (drawMode === "inner") {
      const vertices: Vec2[] = [...outer, ...inner.flatMap(([a, b]) => [a, b])];
      const stick = STICK_PX / pxPerMeter();
      const near = vertices.find((v) => Math.hypot(v[0] - p[0], v[1] - p[1]) < stick);
      if (near) return [near[0], near[1]];
      const snapped = snapPoint(p, pending, vertices, tolerance);
      return nearestOnOuter(snapped, STICK_PX / pxPerMeter()) ?? snapped;
    }
    return p;
  }

  function handleDrawClick(raw: Vec2) {
    if (drawMode === "outer") {
      if (closed) return;
      const first = outer[0];
      if (first && outer.length >= 3 && Math.hypot(first[0] - raw[0], first[1] - raw[1]) * pxPerMeter() < CLOSE_PX) {
        onClose?.();
        setHover(null);
        return;
      }
      emit({ outer: [...outer.map((q) => [q[0], q[1]] as Vec2), snapForDraw(raw)] });
    } else if (drawMode === "inner") {
      const point = snapForDraw(raw);
      if (!pending) {
        setPending(point);
        return;
      }
      if (Math.hypot(point[0] - pending[0], point[1] - pending[1]) > 0.05) {
        emit({ inner: [...inner.map(([a, b]) => [[...a], [...b]] as Segment), [pending, point]] });
      }
      setPending(null);
    } else if (drawMode === "scale") {
      const next = scalePoints.length >= 2 ? [raw] : [...scalePoints, raw];
      setScalePoints(next);
      if (next.length === 2) onScaleLine?.(next[0], next[1]);
    }
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
    if (uncalibrated && onCalibrate && selectedEnds) {
      // 축척을 아직 모르면 — 이 벽을 늘이지 않고, 이 길이로 도면 전체 축척을 맞춘다
      onCalibrate(wallLength(selectedEnds[0], selectedEnds[1]), mm / 1000);
      setMessage(`이 벽을 ${mm.toLocaleString()}mm로 보고 도면 전체 축척을 맞췄어요.`);
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
  /** 그리던 안쪽 벽 시작점·축척 점을 비운다. 비울 게 있었으면 true. */
  function cancelDraw() {
    if (!pending && scalePoints.length === 0) return false;
    setPending(null);
    setScalePoints([]);
    return true;
  }
  const keyStateRef = useRef({ current, deleteSelected, cancelDraw });
  useEffect(() => {
    keyStateRef.current = { current, deleteSelected, cancelDraw };
  });
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const { current, deleteSelected, cancelDraw } = keyStateRef.current;
      if (event.key === "Escape" && !isTypingTarget(event.target) && cancelDraw()) {
        event.stopPropagation();
        return;
      }
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

  const pxPerM = svgWidth > 0 ? svgWidth / view.w : 40;
  // 화면에서 늘 같은 크기로 보이게 — px → m
  const px = (value: number) => value / pxPerM;
  const outward = signedArea(outer) > 0 ? 1 : -1;
  const area = closed && outer.length >= 3 ? polygonArea(outer) : 0;
  // 닫히지 않았으면 마지막 점 → 첫 점 벽은 아직 없다
  const wallCount = closed ? outer.length : Math.max(0, outer.length - 1);
  const drawing = drawMode !== "none";
  // 그리는 중 미리보기 선의 시작점
  const previewFrom: Vec2 | null = drawMode === "outer" && !closed ? outer.at(-1) ?? null
    : drawMode === "inner" ? pending
      : drawMode === "scale" && scalePoints.length === 1 ? scalePoints[0]
        : null;
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
      <div className="relative min-h-0 flex-1">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={cn("absolute inset-0 h-full w-full touch-none select-none text-ink", drawing && "cursor-crosshair")}
        onPointerDown={handleBackgroundDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={() => {
          pointerRef.current = null;
        }}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`도면 편집 — 면적 ${area.toFixed(1)}㎡`}
      >
        <g stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke">
          {gridX.map((x) => <line key={`gx${x}`} x1={x} y1={view.z} x2={x} y2={view.z + view.h} vectorEffect="non-scaling-stroke" />)}
          {gridZ.map((z) => <line key={`gz${z}`} x1={view.x} y1={z} x2={view.x + view.w} y2={z} vectorEffect="non-scaling-stroke" />)}
        </g>

        {background && (
          <image
            href={background.href}
            x={background.x}
            y={background.z}
            width={background.width}
            height={background.height}
            preserveAspectRatio="none"
            opacity={0.75}
            pointerEvents="none"
          />
        )}

        {closed && outer.length >= 3 ? (
          <polygon
            points={outer.map((p) => p.join(",")).join(" ")}
            fill={background ? "rgba(242,188,46,.12)" : "var(--wash, #f4f4f2)"}
            stroke="currentColor"
            strokeWidth={5}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        ) : outer.length >= 2 ? (
          <polyline
            points={outer.map((p) => p.join(",")).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        {/* 바깥벽 — 눌러서 고르기(보이지 않는 굵은 선으로 누르기 쉽게) */}
        {outer.slice(0, wallCount).map((a, i) => {
          const b = outer[(i + 1) % outer.length];
          const selected = current?.kind === "outer" && current.index === i;
          return (
            <g key={`wall-${i}`} pointerEvents={drawing ? "none" : undefined}>
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
            <g key={`inner-${i}`} pointerEvents={drawing ? "none" : undefined}>
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
        {outer.length >= 2 && outer.slice(0, wallCount).map((a, i) => {
          const b = outer[(i + 1) % outer.length];
          const length = wallLength(a, b);
          if (length < 0.2) return null;
          const nx = ((b[1] - a[1]) / length) * outward;
          const nz = (-(b[0] - a[0]) / length) * outward;
          const selected = current?.kind === "outer" && current.index === i;
          // 글자(약 52px)가 벽보다 길면 겹치니까 숨긴다 — 고른 벽은 늘 보여 준다
          if (!selected && length * pxPerM < 64) return null;
          const tx = (a[0] + b[0]) / 2 + nx * px(16);
          const tz = (a[1] + b[1]) / 2 + nz * px(16);
          const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
          const upright = angle > 90 || angle < -90 ? angle + 180 : angle;
          return (
            <text
              key={`dim-${i}`}
              x={tx}
              y={tz}
              fontSize={px(13)}
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


        {/* 꼭짓점 — 끌어서 옮기기 */}
        {outer.map(([x, z], i) => {
          const selected = current?.kind === "vertex" && current.index === i;
          return (
            <circle
              key={`v-${i}`}
              cx={x}
              cy={z}
              r={px(selected ? 7 : 6)}
              fill={selected ? TAPE : "white"}
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className={drawing ? undefined : "cursor-move"}
              pointerEvents={drawing ? "none" : undefined}
              onPointerDown={(event) => handleVertexDown(event, i)}
            />
          );
        })}

        {/* 그리는 중 — 미리보기 선, 안쪽 벽 시작점, 축척 기준 두 점 */}
        {drawing && previewFrom && hover && (
          <line
            x1={previewFrom[0]} y1={previewFrom[1]} x2={hover[0]} y2={hover[1]}
            stroke={drawMode === "scale" ? "#1d6fd1" : TAPE}
            strokeWidth={3}
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )}
        {drawing && hover && (
          <circle cx={hover[0]} cy={hover[1]} r={px(4)} fill={drawMode === "scale" ? "#1d6fd1" : TAPE} pointerEvents="none" />
        )}
        {drawMode === "outer" && !closed && outer.length >= 3 && (
          <circle
            cx={outer[0][0]} cy={outer[0][1]} r={px(CLOSE_PX)}
            fill="none" stroke={TAPE} strokeWidth={2} strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke" pointerEvents="none"
          />
        )}
        {pending && <circle cx={pending[0]} cy={pending[1]} r={px(6)} fill={TAPE} stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        {scalePoints.length > 0 && (
          <g pointerEvents="none">
            {scalePoints.length === 2 && (
              <line
                x1={scalePoints[0][0]} y1={scalePoints[0][1]} x2={scalePoints[1][0]} y2={scalePoints[1][1]}
                stroke="#1d6fd1" strokeWidth={3} vectorEffect="non-scaling-stroke"
              />
            )}
            {scalePoints.map(([x, z], i) => (
              <circle key={`s-${i}`} cx={x} cy={z} r={px(6)} fill="#1d6fd1" stroke="white" strokeWidth={2} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}
      </svg>
        {closed && outer.length >= 3 && (
          <div className="pointer-events-none absolute left-3 top-3 border border-line bg-white/90 px-3 py-1.5 text-xs text-soft">
            <span className="text-sm font-bold text-ink">{area.toFixed(1)}㎡</span> · 약 {toPyeong(area).toFixed(1)}평
            {ceilingHeight ? ` · 천장 ${ceilingHeight.toFixed(2)}m` : ""}
          </div>
        )}
      </div>

      <div className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-t border-line px-3">
        {current && selectionTitle ? (
          <>
            <span className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink">{selectionTitle}</span>
            {current.kind !== "vertex" && selectedLengthMm !== null && (
              <label className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm text-ink">
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
                  className={cn(fieldInputClass, "w-24 py-1.5")}
                  aria-label="벽 길이(mm)"
                />
                mm
              </label>
            )}
            {current.kind !== "vertex" && (
              <button type="button" onClick={splitSelected} className="button button--outline button--sm shrink-0">
                <IconLayoutDistributeVertical size={15} stroke={2} aria-hidden />
                가운데에 점 추가
              </button>
            )}
            {current.kind !== "outer" && (
              <button type="button" onClick={deleteSelected} className="button button--danger button--sm shrink-0">
                <IconTrash size={15} stroke={2} aria-hidden />
                지우기
              </button>
            )}
          </>
        ) : (
          <span className="truncate text-sm text-soft">
            {drawMode === "outer"
              ? closed ? "바깥벽이 닫혔어요." : outer.length < 3 ? `바깥벽 모서리를 차례로 누르세요 (${outer.length}개)` : `계속 찍거나 첫 점을 눌러 닫으세요 (${outer.length}개)`
              : drawMode === "inner"
                ? pending ? "벽이 끝나는 점을 누르세요 (Esc로 취소)" : "안쪽 벽이 시작하는 점을 누르세요"
                : drawMode === "scale"
                  ? scalePoints.length < 2 ? `치수가 적힌 구간의 양 끝을 누르세요 (${scalePoints.length}/2)` : "실제 길이를 mm로 넣어 주세요"
                  : "벽을 누르면 길이(mm)를 고칠 수 있어요. 점은 끌어서 옮기고, 빈 곳을 끌면 화면이 움직여요."}
          </span>
        )}
        {message && <span className="shrink-0 whitespace-nowrap text-xs text-soft" aria-live="polite">{message}</span>}
        <button type="button" onClick={fit} className="button button--outline button--sm ml-auto shrink-0">
          <IconArrowsMaximize size={15} stroke={2} aria-hidden />
          화면 맞춤
        </button>
      </div>
    </div>
  );
}

