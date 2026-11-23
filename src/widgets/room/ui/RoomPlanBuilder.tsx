"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  IconArrowBackUp,
  IconArrowLeft,
  IconCube,
  IconEraser,
  IconHelp,
  IconLayoutBoard,
  IconUpload,
  IconWalk,
  IconWand,
} from "@tabler/icons-react";
import { getErrorMessage } from "@/shared/api";
import { ConfirmDialog } from "@/shared/ui";
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
import { PanelSection as Section, PanelToggleButton } from "./EditorChrome";
import { HeightField } from "./HeightField";
import { PlanEditor, type PlanDrawMode, type PlanShape, type PlanTool } from "./PlanEditor";
import { PlanTutorial, shouldAutoOpenPlanTutorial } from "./PlanTutorial";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { ViewSwitch } from "./ViewSwitch";

const PLAN_ACCEPT = "image/jpeg,image/png";
const NOMINAL_EYE_HEIGHT = 1.5;

type PlanView = Exclude<RoomView, "photo"> | "plan";

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
 * 1) 도면 올리기 → 2) 기준 길이 두 점 + mm로 축척 맞추기(또는 건너뛰고 나중에 벽 길이로) → 3) '벽' 도구로 바깥벽(닫히면 이어서 안쪽 벽) 그리기,
 * 벽 길이·점 고치기 → 4) 천장 높이·바닥에 도면 깔기 → 5) 미니어처·1인칭으로 확인 후 저장.
 */
export function RoomPlanBuilder({ initialDraft, defaultName, backHref, backLabel, onSave }: {
  initialDraft: PlanDraft | null;
  /** 새 도면 방 이름 기본값(예: "도면 1"). */
  defaultName: string;
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
  // 오른쪽 정보 칸 — 접으면 도면을 넓게 쓴다
  const [panelOpen, setPanelOpen] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scaleInputRef = useRef<HTMLInputElement>(null);
  // 되돌리기 — 끌기처럼 0.5초 안에 잇따른 변경은 한 번으로
  const historyRef = useRef<PlanDraft[]>([]);
  const lastChangeRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  // 처음 온 사람에게만 그리는 법을 띄운다 — 저장소는 브라우저에서만 읽을 수 있어 마운트 뒤에 본다
  useEffect(() => {
    if (shouldAutoOpenPlanTutorial()) queueMicrotask(() => setTutorialOpen(true));
  }, []);

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
    setDrawMode(draft && draft.outer.length > 0 ? "none" : "wall");
    setMessage("축척은 나중에 맞춰도 돼요 — 벽을 고르고 실제 길이를 넣으면 그 길이로 도면 전체 축척이 맞춰져요.");
  }

  function changeDrawMode(mode: PlanDrawMode) {
    setView("plan");
    setScaleLine(null);
    setDrawMode(mode);
    setMessage(null);
  }

  function restart() {
    if (!draft) return;
    change({ ...draft, outer: [], inner: [], closed: false }, true);
    setEditorVersion((version) => version + 1);
    setView("plan");
    setDrawMode("wall");
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(draft);
    } catch (error) {
      setSaveError(getErrorMessage(error));
      setPanelOpen(true);
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
  const hasWalls = Boolean(draft && (draft.outer.length > 0 || draft.inner.length > 0));
  const tools: PlanTool[] = [
    {
      id: "detect",
      label: hasWalls ? "자동 초안으로 교체" : "벽 자동 인식",
      caption: "자동 인식",
      hint: "도면에서 벽을 찾아 초안을 그려요. 축척을 먼저 맞추면 더 정확해요.",
      // 추천은 한 번에 하나 — 축척을 맞춘 뒤(맞추면 자동으로 돌지만, 못 찾았을 때 다시 누르라고)
      highlight: Boolean(draft?.calibrated && !hasWalls),
      icon: IconWand,
      onClick: () => draft && void generateWalls(draft),
      disabled: !draft || uploading || saving,
      busy: detecting,
    },
    { id: "undo", label: "되돌리기", caption: "되돌리기", hint: "방금 한 일을 취소해요.", icon: IconArrowBackUp, onClick: undo, disabled: busy || !canUndo },
    { id: "restart", label: "벽 전체 지우기", caption: "전체 삭제", hint: "그린 벽을 모두 지우고 바깥벽부터 다시 그려요. 하나만 지우려면 ‘선택 삭제’를 써요.", icon: IconEraser, onClick: () => setConfirmRestart(true), disabled: !draft || busy || !hasWalls },
  ];
  // 도구 막대 옆 칸 — 축척 재기 중일 때만
  const scalePanel = scaleLine !== null ? (
    <>
      <span className="text-sm font-bold text-ink">실제 길이</span>
      <label className="flex items-center gap-2 text-sm text-ink">
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
          className={cn(fieldInputClass, "w-28 py-1.5")}
          aria-label="기준 길이(mm)"
        />
        mm
        <button type="button" onClick={applyScale} className="button button--primary button--sm ml-auto">적용</button>
      </label>
      <p className="text-xs text-soft">찍은 두 점 사이의 실제 길이예요. 적용하면 벽을 자동으로 찾아 그려요.</p>
    </>
  ) : drawMode === "scale" ? (
    <>
      <span className="text-sm font-bold text-ink">기준 길이 재기</span>
      <p className="text-xs leading-relaxed text-soft">치수가 적힌 가장 긴 구간의 양 끝을 누르세요. 축척을 모르면 건너뛰고 나중에 벽 길이를 넣어도 돼요.</p>
      <button type="button" onClick={skipScale} disabled={busy} className="button button--outline button--sm self-start">건너뛰기</button>
    </>
  ) : null;
  const statusText = saveError ?? (draft && (draft.outer.length > 0 || draft.calibrated) ? validationError : null);

  return (
    <div className="flex h-dvh min-h-[600px] w-full flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <Link href={backHref} aria-label={`${backLabel}(으)로 돌아가기`} title={`${backLabel}(으)로 돌아가기`} className="button button--outline button--sm button--icon">
          <IconArrowLeft size={16} stroke={2} aria-hidden />
        </Link>
        <div className="min-w-[120px] flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-ink">{draft?.name.trim() || defaultName}</h1>
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
          className="order-3 w-full sm:order-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
        />
        {/* 좁은 화면에선 제목 줄 오른쪽에, 시점 바꾸기는 다음 줄 전체 폭으로 */}
        <div className="order-2 flex items-center gap-2 sm:order-3">
          <button
            type="button"
            onClick={() => setTutorialOpen(true)}
            aria-label="도면 그리는 법"
            title="도면 그리는 법"
            className="button button--outline button--sm"
          >
            <IconHelp size={16} stroke={2} aria-hidden />
            <span className="hidden sm:inline">그리는 법</span>
          </button>
          <PanelToggleButton open={panelOpen} onToggle={() => setPanelOpen((open) => !open)} />
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || validationError !== null}
            title={validationError ?? undefined}
            className="button button--primary button--sm"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className={cn("relative shrink-0 lg:h-auto lg:flex-1", panelOpen ? "h-[55dvh]" : "min-h-0 flex-1")}>
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
                  shortcutsEnabled={!tutorialOpen}
                  drawMode={drawMode}
                  onDrawModeChange={changeDrawMode}
                  modes={["none", "wall", "point", "scale"]}
                  actions={tools}
                  highlightMode={draft && !draft.calibrated && drawMode !== "scale" ? "scale" : null}
                  panel={scalePanel}
                  background={floor ? { href: floor.url, x: floor.x, z: floor.z, width: floor.width, height: floor.height } : null}
                  uncalibrated={!draft.calibrated}
                  ceilingHeight={draft.ceilingHeight}
                  onChange={({ outer, inner }: PlanShape) => change({ ...draft, outer, inner })}
                  onClose={() => {
                    change({ ...draft, closed: true });
                    // '벽' 도구는 그대로 — 닫은 뒤엔 이어서 안쪽 벽을 그린다
                    if (drawMode !== "wall") setDrawMode("none");
                    setMessage(draft.calibrated
                      ? "바깥벽을 닫았어요. 이어서 누르면 안쪽 벽(칸막이)이 그려져요. 다 그렸으면 Esc."
                      : "바깥벽을 닫았어요. 길이를 아는 벽을 눌러 mm로 넣으면 축척이 맞춰져요.");
                  }}
                  onScaleLine={handleScaleLine}
                  onScaleReset={() => setScaleLine(null)}
                  onDrawExit={() => setDrawMode("none")}
                  onCalibrate={(current, actual) => change(calibratePlan(draft, current, actual))}
                  className="absolute inset-0"
                />
              )}
            </>
          )}
          <input ref={fileInputRef} type="file" accept={PLAN_ACCEPT} disabled={busy} onChange={(event) => void handleFile(event)} className="sr-only" aria-label="도면 이미지" />
        </div>

        {panelOpen && (
          <aside className="flex min-h-0 flex-col overflow-y-auto border-line lg:w-[340px] lg:shrink-0 lg:border-l">
            {(message || statusText) && (
              <div className="flex flex-col gap-1 border-b border-line bg-wash px-4 py-3 text-sm" aria-live="polite">
                {message && <p className="text-ink">{message}</p>}
                {statusText && <p className={saveError ? "text-coral" : "text-soft"}>{saveError ? statusText : `저장하려면 — ${statusText}`}</p>}
              </div>
            )}

            <Section title="도면" summary={draft ? `${draft.widthPx}×${draft.heightPx}px` : "없음"}>
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

            <Section title="축척" summary={draft?.calibrated ? `1m = ${pixelsPerMeter(draft).toFixed(1)}px` : "아직 몰라요"}>
              <p className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 shrink-0 rounded-full", draft?.calibrated ? "bg-ink" : "bg-coral")} aria-hidden />
                {draft?.calibrated
                  ? <span className="text-ink">맞춤 완료 · 1m = 도면 {pixelsPerMeter(draft).toFixed(1)}px</span>
                  : <span className="text-ink">아직 몰라요</span>}
              </p>
              <p className="text-xs leading-relaxed text-soft">
                왼쪽 도구의 ‘기준 길이 재기’로 치수가 적힌 구간의 양 끝을 누르고 길이를 mm로 넣어요. 벽을 고르고 길이를 넣어도 축척이 맞춰져요.
              </p>
            </Section>

            <Section title="설정" summary={draft ? `${draft.name.trim() || defaultName} · 천장 ${draft.ceilingHeight.toFixed(2)}m` : undefined}>
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

            <Section title="방 정보" summary={summary ? `${summary.areaM2.toFixed(1)}㎡ · 약 ${summary.areaPyeong.toFixed(1)}평` : undefined}>
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

            <Section title="그리는 법" defaultOpen={false}>
              <button type="button" onClick={() => setTutorialOpen(true)} className="button button--outline button--sm mb-2 self-start">
                <IconHelp size={15} stroke={2} aria-hidden />
                그림으로 보기
              </button>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-soft">
                <li>도구는 도면 왼쪽 막대에 있어요. 마우스를 올리면 설명이 보이고, ‘추천’이 붙은 도구가 지금 쓰면 좋은 도구예요.</li>
                <li>‘벽’ 도구 하나로 그려요. 점을 찍을 때마다 앞 점과 벽으로 이어지고, <b className="font-semibold text-ink">Esc</b>로 선을 끊고, 한 번 더 누르면 그리기가 끝나요.</li>
                <li>처음엔 바깥벽이 그려지고, 첫 점을 다시 누르면 닫혀요. 닫은 뒤에 누르는 점은 안쪽 벽(칸막이)이 돼요.</li>
                <li>‘선 위에 점 추가’로 벽의 원하는 자리를 누르면 점이 생기고, 바로 끌어서 옮길 수 있어요.</li>
                <li>벽을 고르고 숫자를 치면 길이(mm)가 바뀌어요. 문 틈은 안쪽 벽을 끊어서 비워 두세요.</li>
              </ul>
            </Section>
          </aside>
        )}
      </div>
      {tutorialOpen && <PlanTutorial onClose={() => setTutorialOpen(false)} />}
      {confirmRestart && (
        <ConfirmDialog
          title="벽 전체 지우기"
          confirmLabel="전체 지우기"
          onConfirm={() => {
            setConfirmRestart(false);
            restart();
          }}
          onCancel={() => setConfirmRestart(false)}
        >
          그린 바깥벽과 안쪽 벽을 모두 지우고 처음부터 다시 그려요. 하나만 지우려면 그것을 고르고 ‘선택 삭제’나 Delete를 누르세요. 지운 뒤에도 ‘되돌리기’로 살릴 수 있어요.
        </ConfirmDialog>
      )}
    </div>
  );
}
