"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type ReactNode } from "react";
import {
  IconArrowsMaximize,
  IconBorderOuter,
  IconCirclePlus,
  IconLine,
  IconPointer,
  IconRuler2,
  IconTrash,
} from "@tabler/icons-react";
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
  type Segment,
} from "../lib/planEdit";
import { RailButton, RailDivider, ToolRail, type ToolIcon } from "./EditorChrome";

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

/**
 * 편집 도구 — "none" 고르기·끌기 / "wall" 벽 그리기(바깥벽이 아직 안 닫혔으면 바깥벽, 닫혔으면 안쪽 벽) /
 * 바깥벽 모서리 찍기 / 안쪽 벽 이어 그리기 / 선 위에 점 넣기 / 축척 기준 두 점 찍기.
 */
export type PlanDrawMode = "none" | "wall" | "outer" | "inner" | "point" | "scale";

/** 왼쪽 도구 막대의 동작 버튼(자동 인식·되돌리기 등 — 도구를 바꾸지 않고 한 번 실행). */
export interface PlanTool {
  id: string;
  label: string;
  /** 아이콘 아래 짧은 이름. */
  caption?: string;
  /** 마우스를 올렸을 때 설명. */
  hint?: string;
  /** 지금 쓰면 좋은 동작('추천' 표시). */
  highlight?: boolean;
  icon: ToolIcon;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}

const MODE_TOOLS: Record<PlanDrawMode, { label: string; caption: string; hint: string; icon: ToolIcon }> = {
  none: { label: "고르기·옮기기", caption: "고르기", hint: "벽을 눌러 길이를 고치고, 점을 끌어 옮겨요. 빈 곳을 끌면 화면이 움직여요.", icon: IconPointer },
  wall: {
    label: "벽 그리기",
    caption: "벽",
    hint: "누르는 점마다 벽이 이어져요. 바깥벽부터 그리고 첫 점을 다시 누르면 닫혀요. 닫은 뒤엔 안쪽 벽이 그려져요. Esc로 끊어요.",
    icon: IconLine,
  },
  outer: { label: "바깥벽 그리기", caption: "바깥벽", hint: "모서리를 차례로 눌러요. 첫 점을 다시 누르면 닫혀요.", icon: IconBorderOuter },
  inner: { label: "안쪽 벽 그리기", caption: "안쪽 벽", hint: "누르는 점마다 벽이 이어져요. Esc로 끊어요.", icon: IconLine },
  point: { label: "선 위에 점 추가", caption: "점 추가", hint: "벽 위 원하는 자리를 누르면 점이 생겨요. 바로 끌어서 옮길 수 있어요.", icon: IconCirclePlus },
  scale: { label: "기준 길이 재기", caption: "축척", hint: "치수가 적힌 구간의 양 끝을 누르고 실제 길이를 mm로 넣어요.", icon: IconRuler2 },
};


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

/** 화면 맞춤 때 왼쪽 도구 막대 몫으로 비워 두는 폭(px) — 넓은 화면은 이름까지 보이는 막대. */
const railReservePx = (width: number) => (width >= 640 ? 96 : 62);

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
 *  - 꼭짓점 끌기(이웃 점과 수평·수직, 다른 점의 x·z에 자동으로 맞춤), Delete로 지우기(3개 미만 불가)
 *  - "선 위에 점 추가" 도구로 벽의 원하는 자리를 누르면 그 자리에 점이 생긴다(안쪽 벽은 두 벽으로 나뉜다)
 *  - 빈 곳을 끌면 화면 이동, 휠로 확대
 * 편집 도구는 왼쪽 도구 막대에 모은다. `drawMode`를 넘기면 부모가 도구를 정하고(`onDrawModeChange`), 안 넘기면 스스로 정한다.
 */
export function PlanEditor({
  outer,
  inner = [],
  onChange,
  ceilingHeight,
  closed = true,
  drawMode: controlledMode,
  onDrawModeChange,
  modes = ["none", "point"],
  actions = [],
  highlightMode = null,
  panel = null,
  background = null,
  uncalibrated = false,
  onClose,
  onScaleLine,
  onCalibrate,
  onDrawExit,
  className,
}: {
  outer: readonly Vec2[];
  inner?: readonly Segment[];
  onChange: (shape: PlanShape) => void;
  ceilingHeight?: number;
  /** 바깥벽이 닫혔는지 — 그리는 중이면 false(마지막 점과 첫 점 사이 벽이 없다). */
  closed?: boolean;
  drawMode?: PlanDrawMode;
  onDrawModeChange?: (mode: PlanDrawMode) => void;
  /** 도구 막대에 보일 도구(순서대로). */
  modes?: PlanDrawMode[];
  /** 도구 막대 아래쪽 동작 버튼. */
  actions?: PlanTool[];
  /** '추천' 표시할 도구(지금 단계에서 쓰면 좋은 것). */
  highlightMode?: PlanDrawMode | null;
  /** 도구 막대 옆 떠 있는 칸에 보일 내용(고른 것이 없을 때) — 예: 축척 길이 입력. */
  panel?: ReactNode;
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
  /** 그리는 중 끊을 선이 없을 때 Esc를 한 번 더 누르면 — 그리기를 끝낸다. */
  onDrawExit?: () => void;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const lengthInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<View>(() => fitView(outer, 1.6));
  const [selection, setSelection] = useState<Selection>(null);
  const [lengthText, setLengthText] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // 그리는 중 — 안쪽 벽 시작점, 축척 두 점, 마우스 자리(미리보기 선)
  // 안쪽 벽은 찍는 점마다 앞 점과 이어지고(연속), Esc로 끊는다. 끊긴 뒤 다음 점이 새 시작점.
  const [pending, setPending] = useState<Vec2 | null>(null);
  // 바깥벽을 Esc로 끊었는지 — 끊긴 뒤엔 양 끝점(첫 점·마지막 점) 중 하나를 눌러 거기서 이어 그린다
  const [outerPaused, setOuterPaused] = useState(false);
  const [scalePoints, setScalePoints] = useState<Vec2[]>([]);
  const [hover, setHover] = useState<Vec2 | null>(null);
  const [localMode, setLocalMode] = useState<PlanDrawMode>("none");
  // 고른 도구(막대에 켜지는 것)와 실제로 그리는 것 — '벽'은 바깥벽이 닫히기 전엔 바깥벽, 닫힌 뒤엔 안쪽 벽을 그린다
  const toolMode = controlledMode ?? localMode;
  const drawMode: PlanDrawMode = toolMode === "wall" ? (closed ? "inner" : "outer") : toolMode;
  function changeMode(next: PlanDrawMode) {
    if (onDrawModeChange) onDrawModeChange(next);
    else setLocalMode(next);
  }
  const [lastDrawMode, setLastDrawMode] = useState(drawMode);
  if (lastDrawMode !== drawMode) {
    // 그리기 종류가 바뀌면 그리던 것을 비운다(렌더 중 상태 맞추기)
    setLastDrawMode(drawMode);
    setPending(null);
    setOuterPaused(false);
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
    const width = svg?.clientWidth ?? 0;
    const height = svg?.clientHeight ?? 0;
    // 왼쪽 도구 막대 자리를 비우고 나머지 폭에 맞춘다(좁은 화면에서 막대가 벽을 가리지 않게)
    const usable = width - railReservePx(width);
    const aspect = height > 0 && usable > 0 ? usable / height : 1.6;
    // 바깥벽이 아직 없으면 도면 이미지 전체가 보이게
    const target: Vec2[] = outer.length >= 2 || !background
      ? outer.map((p) => [p[0], p[1]])
      : [[background.x, background.z], [background.x + background.width, background.z + background.height]];
    const fitted = fitView(target, aspect);
    if (!(usable > 0)) {
      setView(fitted);
      return;
    }
    const w = (fitted.w * width) / usable;
    setView({ ...fitted, x: fitted.x - (w - fitted.w), w });
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
    if (drawMode === "point" && next && next.kind !== "vertex") {
      const p = toPlan(event.clientX, event.clientY);
      if (p) insertPoint(next, p);
      return;
    }
    select(next);
  }

  /** 벽 위 가장 가까운 점(선분 위로 투영). 양 끝에 너무 붙으면 null(점이 겹치지 않게). */
  function projectOnWall(a: Vec2, b: Vec2, p: Vec2): Vec2 | null {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSq = dx * dx + dz * dz;
    if (lengthSq < 1e-6) return null;
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSq;
    const margin = Math.min(0.45, 0.05 / Math.sqrt(lengthSq));
    if (t < margin || t > 1 - margin) return null;
    return [a[0] + t * dx, a[1] + t * dz];
  }

  /** 점 추가 도구 — 마우스 가까운 벽과 그 위의 자리. */
  function nearestWallPoint(p: Vec2): { wall: Exclude<Selection, null>; point: Vec2 } | null {
    const tolerance = STICK_PX / pxPerMeter();
    let best: { wall: Exclude<Selection, null>; point: Vec2 } | null = null;
    let bestDistance = tolerance;
    const consider = (wall: Exclude<Selection, null>, a: Vec2, b: Vec2) => {
      const q = projectOnWall(a, b, p);
      if (!q) return;
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bestDistance) {
        bestDistance = d;
        best = { wall, point: q };
      }
    };
    const count = closed ? outer.length : Math.max(0, outer.length - 1);
    for (let i = 0; i < count; i++) consider({ kind: "outer", index: i }, outer[i], outer[(i + 1) % outer.length]);
    inner.forEach(([a, b], i) => consider({ kind: "inner", index: i }, a, b));
    return best;
  }

  function insertPoint(wall: Exclude<Selection, null>, p: Vec2) {
    if (wall.kind === "outer") {
      const q = projectOnWall(outer[wall.index], outer[(wall.index + 1) % outer.length], p);
      if (!q) return;
      const next = outer.map((v) => [v[0], v[1]] as Vec2);
      next.splice(wall.index + 1, 0, [q[0], q[1]]);
      emit({ outer: next });
      select({ kind: "vertex", index: wall.index + 1 });
      setMessage("점을 넣었어요. 점을 끌어서 옮길 수 있어요.");
    } else if (wall.kind === "inner") {
      const [a, b] = inner[wall.index];
      const q = projectOnWall(a, b, p);
      if (!q) return;
      const next = inner.flatMap(([s, e], i) => (i === wall.index
        ? [[[s[0], s[1]], [q[0], q[1]]], [[q[0], q[1]], [e[0], e[1]]]] as Segment[]
        : [[[s[0], s[1]], [e[0], e[1]]] as Segment]));
      emit({ inner: next });
      setMessage("안쪽 벽을 그 자리에서 둘로 나눴어요.");
    }
  }

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const pointer = pointerRef.current;
    if (drawMode !== "none" && (!pointer || !pointer.moved)) {
      const p = toPlan(event.clientX, event.clientY);
      setHover(p ? (drawMode === "point" ? nearestWallPoint(p)?.point ?? null : snapForDraw(p)) : null);
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

  function handlePointClick(raw: Vec2) {
    const hit = nearestWallPoint(raw);
    if (hit) insertPoint(hit.wall, hit.point);
    else setMessage("벽(선) 위를 눌러 주세요.");
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
      if (outerPaused) {
        // 끊긴 상태 — 양 끝점 가까이면 그 점에 붙는다
        const stick = STICK_PX / pxPerMeter();
        const end = [outer[0], outer.at(-1)].find((v) => v && Math.hypot(v[0] - p[0], v[1] - p[1]) < stick);
        return end ? [end[0], end[1]] : p;
      }
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
      if (outerPaused && outer.length > 0) {
        const stick = STICK_PX / pxPerMeter();
        const last = outer[outer.length - 1];
        const near = (v: Vec2) => Math.hypot(v[0] - raw[0], v[1] - raw[1]) < stick;
        if (near(last)) {
          setMessage(null);
          setOuterPaused(false);
        } else if (near(first)) {
          // 첫 점에서 이어 그리기 — 순서를 뒤집어 첫 점을 마지막 점으로
          emit({ outer: [...outer].reverse().map((q) => [q[0], q[1]] as Vec2) });
          setMessage(null);
          setOuterPaused(false);
        } else {
          setMessage("바깥벽은 한 줄로 이어져야 해요. 첫 점이나 마지막 점을 눌러 거기서 이어 그리세요.");
        }
        return;
      }
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
        setPending(point);
      }
    } else if (drawMode === "point") {
      handlePointClick(raw);
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

  // 키보드 — 벽을 고른 채 숫자를 치면 길이 입력으로, Delete 지우기, Esc 선택 풀기.
  // 리스너는 한 번만 달고 최신 선택·지우기는 ref로 읽는다.
  /**
   * Esc — 이어 그리던 선을 끊는다(안쪽 벽 시작점·바깥벽 이어 그리기·축척 점). 끊을 게 없으면 그리기를 끝낸다.
   * 무언가 했으면 true.
   */
  function cancelDraw() {
    if (pending || scalePoints.length > 0) {
      setPending(null);
      setScalePoints([]);
      return true;
    }
    if (drawMode === "outer" && !closed && outer.length > 0 && !outerPaused) {
      setOuterPaused(true);
      return true;
    }
    if (drawMode !== "none") {
      if (onDrawExit) onDrawExit();
      else changeMode("none");
      return true;
    }
    return false;
  }
  const keyStateRef = useRef({ current, deleteSelected, cancelDraw });
  // 그리기 중 Esc는 선택 해제보다 먼저 — 아래 리스너가 cancelDraw부터 부른다
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
  // 점 추가 도구는 벽을 누르고 점을 끌 수 있어야 한다 — 나머지 그리기 도구만 벽·점 누르기를 막는다
  const blocksHits = drawing && drawMode !== "point";
  // 그리는 중 미리보기 선의 시작점
  const previewFrom: Vec2 | null = drawMode === "outer" && !closed && !outerPaused ? outer.at(-1) ?? null
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
        className={cn("absolute inset-0 h-full w-full touch-none select-none text-ink", blocksHits && "cursor-crosshair")}
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
            <g key={`wall-${i}`} pointerEvents={blocksHits ? "none" : undefined}>
              {selected && (
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={TAPE} strokeWidth={7} vectorEffect="non-scaling-stroke" />
              )}
              <line
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="transparent"
                strokeWidth={18}
                vectorEffect="non-scaling-stroke"
                className={drawMode === "point" ? "cursor-copy" : "cursor-pointer"}
                onPointerDown={(event) => handleWallDown(event, { kind: "outer", index: i })}
              />
            </g>
          );
        })}

        {inner.map(([a, b], i) => {
          const selected = current?.kind === "inner" && current.index === i;
          return (
            <g key={`inner-${i}`} pointerEvents={blocksHits ? "none" : undefined}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={selected ? TAPE : "currentColor"} strokeWidth={4} vectorEffect="non-scaling-stroke" />
              <line
                x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}
                stroke="transparent"
                strokeWidth={18}
                vectorEffect="non-scaling-stroke"
                className={drawMode === "point" ? "cursor-copy" : "cursor-pointer"}
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
              className={blocksHits ? undefined : "cursor-move"}
              pointerEvents={blocksHits ? "none" : undefined}
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
        {/* 끊긴 바깥벽 — 이어 그릴 수 있는 양 끝점 */}
        {drawMode === "outer" && !closed && outerPaused && outer.length > 0 && [outer[0], outer[outer.length - 1]].map(([x, z], i) => (
          <circle
            key={`end-${i}`}
            cx={x} cy={z} r={px(STICK_PX)}
            fill={TAPE} fillOpacity={0.25} stroke={TAPE} strokeWidth={2}
            vectorEffect="non-scaling-stroke" pointerEvents="none"
          />
        ))}
        {drawMode === "outer" && !closed && !outerPaused && outer.length >= 3 && (
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
          <div className="pointer-events-none absolute right-3 top-3 border border-line bg-white/90 px-3 py-1.5 text-xs text-soft">
            <span className="text-sm font-bold text-ink">{area.toFixed(1)}㎡</span> · 약 {toPyeong(area).toFixed(1)}평
            {ceilingHeight ? ` · 천장 ${ceilingHeight.toFixed(2)}m` : ""}
          </div>
        )}

        {/* 왼쪽 도구 막대 — 도구(고르기·그리기·점 추가·축척), 동작(자동 인식·되돌리기 등), 화면 맞춤 */}
        <ToolRail label="도면 편집 도구">
          {modes.map((mode) => (
            <RailButton
              key={mode}
              label={MODE_TOOLS[mode].label}
              caption={MODE_TOOLS[mode].caption}
              hint={MODE_TOOLS[mode].hint}
              icon={MODE_TOOLS[mode].icon}
              active={toolMode === mode}
              highlight={highlightMode === mode}
              disabled={mode === "outer" && closed}
              onClick={() => changeMode(toolMode === mode && mode !== "none" ? "none" : mode)}
            />
          ))}
          {actions.length > 0 && <RailDivider />}
          {actions.map((action) => (
            <RailButton
              key={action.id}
              label={action.busy ? `${action.label} 중…` : action.label}
              caption={action.caption}
              hint={action.hint}
              highlight={action.highlight}
              icon={action.icon}
              disabled={action.disabled || action.busy}
              onClick={action.onClick}
            />
          ))}
          <RailDivider />
          <RailButton label="화면 맞춤" caption="맞춤" hint="방 전체가 보이게 화면을 맞춰요." icon={IconArrowsMaximize} onClick={fit} />
        </ToolRail>

        {/* 도구 막대 옆 — 고른 벽·점 고치기, 또는 부모가 넘긴 칸(축척 입력 등) */}
        {current && selectionTitle ? (
          <div className="absolute left-[62px] top-3 sm:left-[92px] flex w-[230px] flex-col gap-2 border border-line bg-white p-3 shadow-[0_2px_10px_rgba(21,23,28,.12)]">
            <span className="text-sm font-bold text-ink">{selectionTitle}</span>
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
                  className={cn(fieldInputClass, "w-24 py-1.5")}
                  aria-label="벽 길이(mm)"
                />
                mm
              </label>
            )}
            <p className="text-xs leading-relaxed text-soft">
              {current.kind === "vertex"
                ? "끌어서 옮기고, Delete로 지워요."
                : "숫자를 치면 바로 길이를 바꿔요. 점을 넣으려면 ‘선 위에 점 추가’ 도구로 원하는 자리를 누르세요."}
            </p>
            {current.kind !== "outer" && (
              <button type="button" onClick={deleteSelected} className="button button--danger button--sm self-start">
                <IconTrash size={15} stroke={2} aria-hidden />
                지우기
              </button>
            )}
          </div>
        ) : panel ? (
          <div className="absolute left-[62px] top-3 sm:left-[92px] flex w-[260px] flex-col gap-2 border border-line bg-white p-3 shadow-[0_2px_10px_rgba(21,23,28,.12)]">
            {panel}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-3 py-2">
        <span className="line-clamp-2 min-w-0 flex-1 text-sm text-soft">
          {drawMode === "outer"
            ? closed ? "바깥벽이 닫혔어요."
              : outerPaused ? "끊었어요. 첫 점이나 마지막 점을 눌러 거기서 이어 그려요 (Esc로 그리기 끝내기)"
                : outer.length === 0 ? (toolMode === "wall" ? "바깥벽부터 그려요 — 방 모서리를 차례로 누르세요" : "바깥벽 모서리를 차례로 누르세요")
                  : outer.length < 3 ? `다음 모서리를 누르세요 (${outer.length}개 · Esc로 끊기)`
                    : `계속 찍거나 첫 점을 눌러 닫으세요 (${outer.length}개 · Esc로 끊기)`
            : drawMode === "inner"
              ? pending
                ? "다음 점을 누르면 이어서 벽이 생겨요 (Esc로 끊기)"
                : toolMode === "wall"
                  ? "안쪽 벽(칸막이)이 시작할 점을 누르세요 — 기존 점·벽에 붙어요 (Esc로 그리기 끝내기)"
                  : "안쪽 벽이 시작할 점을 누르세요 — 기존 점·벽에 붙어요 (Esc로 그리기 끝내기)"
              : drawMode === "point"
                ? "벽(선) 위 원하는 자리를 누르면 점이 생겨요. 점은 바로 끌어서 옮길 수 있어요 (Esc로 끝내기)"
                : drawMode === "scale"
                  ? scalePoints.length < 2 ? `치수가 적힌 구간의 양 끝을 누르세요 (${scalePoints.length}/2)` : "실제 길이를 mm로 넣어 주세요"
                  : "벽을 누르면 길이(mm)를 고칠 수 있어요. 점은 끌어서 옮기고, 빈 곳을 끌면 화면이 움직여요."}
        </span>
        {message && <span className="shrink-0 text-xs text-soft" aria-live="polite">{message}</span>}
      </div>
    </div>
  );
}

