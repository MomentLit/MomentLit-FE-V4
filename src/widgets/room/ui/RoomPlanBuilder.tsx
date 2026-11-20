"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  IconArrowBackUp,
  IconArrowLeft,
  IconCube,
  IconLayoutBoard,
  IconPencil,
  IconRefresh,
  IconRuler2,
  IconUpload,
  IconWalk,
} from "@tabler/icons-react";
import { getErrorMessage } from "@/shared/api";
import { detectPlanWalls } from "@/entities/room";
import { uploadImage } from "@/shared/api/upload";
import { cn } from "@/shared/lib";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import type { Vec2 } from "../lib/geometry";
import type { RoomStageState, RoomView } from "../lib/stage";
import { MAX_CEILING_HEIGHT, MIN_CEILING_HEIGHT } from "../model";
import {
  applyDetectedWalls,
  calibratePlan,
  createPlanDraft,
  pixelsPerMeter,
  planFloorImage,
  summarizePlan,
  validatePlanDraft,
  type PlanDraft,
} from "../planModel";
import { HeightField } from "./HeightField";
import { PlanEditor, type PlanDrawMode, type PlanShape } from "./PlanEditor";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { ViewSwitch } from "./ViewSwitch";

const PLAN_ACCEPT = "image/jpeg,image/png";
const NOMINAL_EYE_HEIGHT = 1.5;

type PlanView = Exclude<RoomView, "photo"> | "plan";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line p-4">
      <h2 className="text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("도면 이미지를 읽을 수 없어요."));
    };
    image.src = url;
  });
}

/**
 * 도면 이미지로 3D 방을 만드는 화면(`/spaces/{id}/rooms/plan`, 사이드바 없는 전체 화면).
 * 1) 도면 올리기 → 2) 기준 길이 두 점 + mm로 축척 맞추기(또는 건너뛰고 나중에 벽 길이로) → 3) 바깥벽·안쪽 벽 그리기,
 * 벽 길이·점 고치기 → 4) 천장 높이·바닥에 도면 깔기 → 5) 미니어처·1인칭으로 확인 후 저장.
 */
export function RoomPlanBuilder({ initialDraft, defaultName, title, backHref, backLabel, onSave }: {
  initialDraft: PlanDraft | null;
  /** 새 도면 방 이름 기본값(예: "도면 1"). */
  defaultName: string;
  /** 공간 이름. */
  title: string;
  backHref: string;
  backLabel: string;
  onSave: (draft: PlanDraft) => Promise<void>;
}) {
  const [draft, setDraftState] = useState<PlanDraft | null>(initialDraft);
  const [view, setView] = useState<PlanView>("plan");
  const [drawMode, setDrawMode] = useState<PlanDrawMode>(initialDraft ? "none" : "scale");
  const [editorVersion, setEditorVersion] = useState(0);
  const [scaleLine, setScaleLine] = useState<number | null>(null);
  const [scaleText, setScaleText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scaleInputRef = useRef<HTMLInputElement>(null);
  // 되돌리기 — 끌기처럼 0.5초 안에 잇따른 변경은 한 번으로
  const historyRef = useRef<PlanDraft[]>([]);
  const lastChangeRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    if (scaleLine !== null) scaleInputRef.current?.focus();
  }, [scaleLine]);

  function change(next: PlanDraft, checkpoint = false) {
    if (!draft) return;
    const now = Date.now();
    if (checkpoint || now - lastChangeRef.current > 500) {
      historyRef.current.push(draft);
      setCanUndo(true);
    }
    lastChangeRef.current = now;
    setDraftState(next);
  }

  function undo() {
    const previous = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    lastChangeRef.current = 0;
    if (previous) {
      setDraftState(previous);
      setDrawMode("none");
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!PLAN_ACCEPT.split(",").includes(file.type)) {
      setMessage("도면은 JPG나 PNG로 올려 주세요.");
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const { width, height } = await readImageSize(file);
      // 도면에는 얼굴·번호판이 없어 블라인드 처리를 하지 않는다(선이 뭉개지지 않게)
      const url = await uploadImage(file, { privacyBlur: false });
      const next = createPlanDraft(url, width, height, draft?.name ?? defaultName);
      historyRef.current = [];
      lastChangeRef.current = 0;
      setCanUndo(false);
      setDraftState({ ...next, ceilingHeight: draft?.ceilingHeight ?? next.ceilingHeight });
      setView("plan");
      setDrawMode("scale");
      setScaleLine(null);
      setMessage("먼저 기준 길이 하나만 알려 주세요 — 도면에서 치수가 적힌 가장 긴 구간의 양 끝을 누르세요.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  function handleScaleLine(a: Vec2, b: Vec2) {
    setScaleLine(Math.hypot(b[0] - a[0], b[1] - a[1]));
    setScaleText("");
    scaleInputRef.current?.focus();
  }

  async function generateWalls(target: PlanDraft) {
    if (detecting) return;
    setDetecting(true);
    setView("plan");
    setDrawMode("none");
    setScaleLine(null);
    setMessage("도면에서 벽을 찾고 있어요…");
    try {
      const detection = await detectPlanWalls(target.imageUrl, target.calibrated ? target.metersPerPixel : undefined);
      const next = detection.ok ? applyDetectedWalls(target, detection) : null;
      if (!next) {
        setMessage(!detection.ok && detection.reason ? `${detection.reason} 벽을 직접 그리거나 다시 시도해 주세요.` : "벽을 자동으로 그리지 못했어요. 직접 그리거나 다시 시도해 주세요.");
        return;
      }
      historyRef.current.push(target);
      lastChangeRef.current = 0;
      setCanUndo(true);
      setDraftState(next);
      setMessage(target.calibrated
        ? "벽 초안을 그렸어요. 도면에서 확인하고 수정해 주세요."
        : "벽 초안을 그렸어요. 기준 길이를 재거나 벽 길이를 입력해서 실제 크기를 맞춰 주세요.");
    } catch (error) {
      setMessage(`${getErrorMessage(error)} 벽을 직접 그리거나 다시 시도해 주세요.`);
    } finally {
      setDetecting(false);
    }
  }

  function applyScale() {
    if (!draft || scaleLine === null) return;
    const mm = Number(scaleText);
    if (!(scaleLine > 0)) {
      setMessage("기준 길이의 양 끝을 서로 다른 점으로 찍어 주세요.");
      return;
    }
    if (!(mm >= 100 && mm <= 1_000_000)) {
      setMessage("기준 길이는 100~1,000,000mm로 넣어 주세요.");
      return;
    }
    const calibrated = calibratePlan(draft, scaleLine, mm / 1000);
    change(calibrated, true);
    setScaleLine(null);
    setDrawMode("none");
    if (draft.outer.length === 0 && draft.inner.length === 0) {
      void generateWalls(calibrated);
    } else {
      setMessage("축척을 맞췄어요. 그린 벽은 도면 위에 그대로 남겨 뒀어요.");
    }
  }

  function handleScaleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      applyScale();
    }
  }

  function skipScale() {
    if (!draft) return;
    if (draft.outer.length === 0 && draft.inner.length === 0) {
      void generateWalls(draft);
      return;
    }
    setScaleLine(null);
    setDrawMode(draft && draft.outer.length > 0 ? "none" : "outer");
    setMessage("축척은 나중에 맞춰도 돼요 — 벽을 고르고 실제 길이를 넣으면 그 길이로 도면 전체 축척이 맞춰져요.");
  }

  function toggleDraw(mode: PlanDrawMode) {
    setView("plan");
    setScaleLine(null);
    setDrawMode((current) => (current === mode ? "none" : mode));
    setMessage(null);
  }

  function restart() {
    if (!draft) return;
    change({ ...draft, outer: [], inner: [], closed: false }, true);
    setEditorVersion((version) => version + 1);
    setView("plan");
    setDrawMode("outer");
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (error) {
      setSaveError(getErrorMessage(error));
      setSaving(false);
    }
  }

  const summary = draft ? summarizePlan(draft) : null;
  const validationError = draft ? validatePlanDraft(draft) : "도면 이미지를 먼저 올려 주세요.";
  const floor = draft ? planFloorImage(draft) : null;
  const stageState = useMemo<RoomStageState>(() => ({
    surface: { kind: "plan", floor: draft?.showFloor && floor ? floor : null },
    walkStart: null,
    outer: draft?.closed ? draft.outer : [],
    corners: [],
    inner: draft?.closed ? draft.inner : [],
    cameraHeight: NOMINAL_EYE_HEIGHT,
    ceilingHeight: draft?.ceilingHeight ?? 2.4,
  // floor는 draft에서 계산 — draft의 해당 값이 바뀔 때만 새로 만든다
  }), [draft?.closed, draft?.outer, draft?.inner, draft?.ceilingHeight, draft?.showFloor, floor?.url, floor?.x, floor?.z, floor?.width, floor?.height]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = uploading || saving || detecting;

  return (
    <div className="flex h-dvh min-h-[600px] w-full flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <Link href={backHref} aria-label={`${backLabel}(으)로 돌아가기`} title={`${backLabel}(으)로 돌아가기`} className="button button--outline button--sm button--icon">
          <IconArrowLeft size={16} stroke={2} aria-hidden />
        </Link>
        <div className="min-w-[120px] flex-1">
          <span className="block font-mono text-[0.62rem] font-medium uppercase leading-none tracking-[0.18em] text-soft">도면으로 3D 방 만들기</span>
          <h1 className="truncate text-base font-bold leading-tight text-ink">{title} · {draft?.name.trim() || defaultName}</h1>
        </div>
        <ViewSwitch
          options={[
            { id: "plan", label: "도면", icon: IconLayoutBoard, disabled: !draft },
            { id: "miniature", label: "미니어처", icon: IconCube, disabled: !summary },
            { id: "walk", label: "1인칭", icon: IconWalk, disabled: !summary },
          ]}
          value={view}
          onChange={(next) => {
            if (detecting) return;
            setView(next);
            if (next !== "plan") setDrawMode("none");
          }}
          className="w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
        />
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative h-[55dvh] shrink-0 lg:h-auto lg:flex-1">
          {!draft ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-wash p-8 text-center">
              <IconUpload size={32} stroke={1.5} className="text-soft" aria-hidden />
              <p className="max-w-[420px] text-sm text-ink">
                평면 도면 이미지(JPG·PNG)를 올려 주세요. 도면 위에 벽을 따라 그리면 실제 크기의 3D 방이 만들어져요.
              </p>
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="button button--primary">
                {uploading ? "올리는 중…" : "도면 올리기"}
              </button>
            </div>
          ) : (
            <>
              <RoomStageCanvas imageUrl={null} state={stageState} view={view === "plan" ? "miniature" : view} className="h-full w-full" />
              {view === "plan" && detecting && floor && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-wash p-6" role="status">
                  <svg viewBox={`0 0 ${draft.widthPx} ${draft.heightPx}`} aria-hidden className="min-h-0 w-full flex-1">
                    <image href={floor.url} width={draft.widthPx} height={draft.heightPx} />
                  </svg>
                  <p className="shrink-0 text-sm text-ink">도면에서 벽을 찾고 있어요…</p>
                </div>
              )}
              {view === "plan" && !detecting && (
                <PlanEditor
                  key={`${draft.imageUrl}:${editorVersion}`}
                  outer={draft.outer}
                  inner={draft.inner}
                  closed={draft.closed}
                  drawMode={drawMode}
                  background={floor ? { href: floor.url, x: floor.x, z: floor.z, width: floor.width, height: floor.height } : null}
                  uncalibrated={!draft.calibrated}
                  ceilingHeight={draft.ceilingHeight}
                  onChange={({ outer, inner }: PlanShape) => change({ ...draft, outer, inner })}
                  onClose={() => {
                    change({ ...draft, closed: true });
                    setDrawMode("none");
                    setMessage(draft.calibrated
                      ? "바깥벽을 닫았어요. 안쪽 벽을 그리거나 미니어처로 확인해 보세요."
                      : "바깥벽을 닫았어요. 길이를 아는 벽을 눌러 mm로 넣으면 축척이 맞춰져요.");
                  }}
                  onScaleLine={handleScaleLine}
                  onDrawExit={() => setDrawMode("none")}
                  onCalibrate={(current, actual) => change(calibratePlan(draft, current, actual))}
                  className="absolute inset-0"
                />
              )}
            </>
          )}
          <input ref={fileInputRef} type="file" accept={PLAN_ACCEPT} disabled={busy} onChange={(event) => void handleFile(event)} className="sr-only" aria-label="도면 이미지" />
        </div>

        <aside className="flex min-h-0 flex-col border-line lg:w-[360px] lg:shrink-0 lg:border-l">
          <div className="flex-1 overflow-y-auto">
            {message && (
              <p className="border-b border-line bg-wash px-4 py-3 text-sm text-ink" aria-live="polite">{message}</p>
            )}

            <Section title="도면">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm text-soft">
                  {draft ? `도면 이미지 · ${draft.widthPx}×${draft.heightPx}px` : "아직 올리지 않았어요"}
                </span>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="button button--outline button--sm shrink-0">
                  <IconUpload size={15} stroke={2} aria-hidden />
                  {draft ? "다른 도면으로" : "도면 올리기"}
                </button>
              </div>
              {draft && <p className="text-xs text-soft">다른 도면으로 바꾸면 그린 벽과 축척은 처음부터 다시 해요.</p>}
            </Section>

            <Section title="축척">
              <p className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 shrink-0 rounded-full", draft?.calibrated ? "bg-ink" : "bg-coral")} aria-hidden />
                {draft?.calibrated
                  ? <span className="text-ink">맞춤 완료 · 1m = 도면 {pixelsPerMeter(draft).toFixed(1)}px</span>
                  : <span className="text-ink">아직 몰라요</span>}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleDraw("scale")}
                  disabled={!draft || busy}
                  aria-pressed={drawMode === "scale"}
                  className={cn("button button--sm", drawMode === "scale" ? "button--primary" : "button--outline")}
                >
                  <IconRuler2 size={15} stroke={2} aria-hidden />
                  기준 길이 재기
                </button>
                <button type="button" onClick={skipScale} disabled={!draft || busy || drawMode !== "scale"} className="button button--outline button--sm">
                  건너뛰기
                </button>
              </div>
              {scaleLine !== null && (
                <label className="flex items-center gap-2 text-sm text-ink">
                  실제 길이
                  <input
                    ref={scaleInputRef}
                    type="number"
                    inputMode="numeric"
                    min={100}
                    step={10}
                    value={scaleText}
                    onChange={(event) => setScaleText(event.target.value)}
                    onKeyDown={handleScaleKeyDown}
                    placeholder="예: 5400"
                    className={cn(fieldInputClass, "w-28 py-2")}
                    aria-label="기준 길이(mm)"
                  />
                  mm
                  <button type="button" onClick={applyScale} className="button button--primary button--sm ml-auto">적용</button>
                </label>
              )}
              <p className="text-xs leading-relaxed text-soft">
                도면에서 치수가 적힌 가장 긴 구간의 양 끝을 누르고 그 길이를 mm로 넣어요. 벽을 고르고 길이를 넣어도 축척이 맞춰져요.
              </p>
            </Section>

            <Section title="벽 그리기">
              <button type="button" onClick={() => draft && void generateWalls(draft)} disabled={!draft || busy} className="button button--outline button--sm self-start">
                <IconRefresh size={15} stroke={2} aria-hidden />
                {detecting ? "벽 찾는 중…" : draft && (draft.outer.length > 0 || draft.inner.length > 0) ? "자동 초안으로 교체" : "벽 자동 인식"}
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => toggleDraw("outer")}
                  disabled={!draft || busy || draft.closed}
                  aria-pressed={drawMode === "outer"}
                  className={cn("button button--sm", drawMode === "outer" ? "button--primary" : "button--outline")}
                >
                  <IconPencil size={15} stroke={2} aria-hidden />
                  바깥벽 그리기
                </button>
                <button
                  type="button"
                  onClick={() => toggleDraw("inner")}
                  disabled={!draft || busy}
                  aria-pressed={drawMode === "inner"}
                  className={cn("button button--sm", drawMode === "inner" ? "button--primary" : "button--outline")}
                >
                  <IconPencil size={15} stroke={2} aria-hidden />
                  안쪽 벽 그리기
                </button>
                <button type="button" onClick={undo} disabled={busy || !canUndo} className="button button--outline button--sm">
                  <IconArrowBackUp size={15} stroke={2} aria-hidden />
                  되돌리기
                </button>
                <button
                  type="button"
                  onClick={restart}
                  disabled={!draft || busy || (draft.outer.length === 0 && draft.inner.length === 0)}
                  className="button button--outline button--sm"
                >
                  <IconRefresh size={15} stroke={2} aria-hidden />
                  처음부터
                </button>
              </div>
              <p className="text-xs leading-relaxed text-soft">
                점을 찍을 때마다 앞 점과 벽으로 이어져요. <b className="font-semibold text-ink">Esc</b>를 누르면 이어지던 선이 끊기고,
                다음에 찍는 점부터 새로 시작해요(바깥벽은 첫 점·마지막 점에서 다시 이어요). 한 번 더 Esc면 그리기가 끝나요.
                바깥벽은 첫 점을 다시 누르면 닫혀요. 안쪽 벽은 기존 점·벽에 붙고, 문 틈은 끊어서 비워 두세요.
              </p>
            </Section>

            <Section title="설정">
              <label className="flex flex-col gap-1.5 text-sm font-semibold text-ink">
                방 이름
                <input
                  value={draft?.name ?? ""}
                  maxLength={100}
                  disabled={!draft || busy}
                  onChange={(event) => draft && setDraftState({ ...draft, name: event.target.value })}
                  placeholder={defaultName}
                  className={fieldInputClass}
                />
              </label>
              <HeightField
                label="천장 높이"
                value={draft?.ceilingHeight ?? 2.4}
                min={MIN_CEILING_HEIGHT}
                max={MAX_CEILING_HEIGHT}
                disabled={!draft || busy}
                onCommit={(value) => draft && change({ ...draft, ceilingHeight: value })}
              />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={draft?.showFloor ?? true}
                  disabled={!draft || busy}
                  onChange={(event) => draft && change({ ...draft, showFloor: event.target.checked })}
                />
                3D 바닥에 도면 깔기
              </label>
            </Section>

            <Section title="방 정보">
              {summary && draft ? (
                <>
                  <p className="text-2xl font-bold text-ink">
                    {summary.areaM2.toFixed(1)}㎡ <span className="text-base font-semibold text-soft">약 {summary.areaPyeong.toFixed(1)}평</span>
                  </p>
                  <p className="text-sm text-soft">천장 {draft.ceilingHeight.toFixed(2)}m · 안쪽 벽 {draft.inner.length}개</p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-ink">
                    {summary.wallLengths.map((length, index) => (
                      <li key={index} className="flex justify-between">
                        <span className="text-soft">벽 {index + 1}–{(index + 1) % summary.wallLengths.length + 1}</span>
                        {length.toFixed(2)}m
                      </li>
                    ))}
                  </ul>
                  {!draft.calibrated && <p className="text-xs text-coral">축척을 아직 맞추지 않아 크기가 실제와 다를 수 있어요.</p>}
                </>
              ) : (
                <p className="text-sm text-soft">바깥벽을 그리고 닫으면 면적과 벽 길이가 나와요.</p>
              )}
            </Section>
          </div>

          <div className="flex flex-col gap-2 border-t border-line p-4">
            <p className="min-h-5 text-sm text-soft" aria-live="polite">
              {saveError ?? (draft && (draft.outer.length > 0 || draft.calibrated) ? validationError ?? "" : "")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={backHref} className={cn("button button--outline", busy && "pointer-events-none opacity-50")}>
                취소
              </Link>
              <button type="button" onClick={() => void handleSave()} disabled={busy || validationError !== null} className="button button--primary">
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
