"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getErrorMessage } from "@/shared/api";
import { ConfirmDialog } from "@/shared/ui";
import Link from "next/link";
import {
  IconArrowBackUp,
  IconArrowLeft,
  IconCube,
  IconEraser,
  IconHelp,
  IconLayoutBoard,
  IconRuler2,
  IconVectorTriangle,
  IconView360,
  IconWalk,
  IconWand,
} from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import { directionToUv, floorCornersFromLayout, measureCeilingHeight, outerFromCorners, round, type Vec2 } from "../lib/geometry";
import { outerOfCorners, type PickMode, type RoomStageState, type RoomView } from "../lib/stage";
import {
  createRoomDraft,
  MAX_CAMERA_HEIGHT,
  MAX_CEILING_HEIGHT,
  MIN_CAMERA_HEIGHT,
  MIN_CEILING_HEIGHT,
  scaleRoomFromWall,
  summarizeRoom,
  validateRoomDraft,
  withCameraHeight,
  innerToRelative,
  withCeilingHeight,
  type RoomDraft,
} from "../model";
import { HeightField } from "./HeightField";
import { PanelSection as Section, PanelToggleButton, RailButton, RailDivider, ToolRail } from "./EditorChrome";
import { PanoramaTutorial, shouldAutoOpenPanoramaTutorial } from "./PanoramaTutorial";
import { PlanEditor, type PlanShape, type PlanTool } from "./PlanEditor";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { ViewSwitch } from "./ViewSwitch";
import { useLayoutDetection } from "./useLayoutDetection";

/**
 * 호스트가 360° 장면 하나로 실제 크기의 3D 방을 만드는 화면(`/spaces/{id}/rooms/edit`, 사이드바 없는 전체 화면).
 * 1) 바닥 모서리 찾기(자동 또는 직접 찍기, 도면에서 수치로 고치기) → 2) 높이 맞추기 → 3) 미니어처로 확인 후 저장.
 * 저장은 부모(`onSave`)가 서버에 한다.
 */
export function RoomBuilder({ scene, sceneLabel, initialDraft, backHref, backLabel, onSave }: {
  scene: PanoramaTourScene;
  /** 화면에 보일 장면 이름(예: "거실", "장면 2"). */
  sceneLabel: string;
  initialDraft: RoomDraft | null;
  /** 돌아갈 곳(들어온 곳 — 공간 수정 또는 3D 방 관리). */
  backHref: string;
  /** 돌아갈 곳 이름(예: "공간 수정") — 뒤로 가기 버튼 설명. */
  backLabel: string;
  /** 저장 — 실패하면 오류를 던진다(화면에 문구로 보여 준다). */
  onSave: (draft: RoomDraft) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoomDraft>(() => initialDraft ?? createRoomDraft(scene.image_url));
  // "plan" — 위에서 본 도면에서 벽 길이·꼭짓점을 수치로 고친다
  const [view, setView] = useState<RoomView | "plan">("photo");
  // 되돌리기 기록(모서리·안쪽 벽). 끌기처럼 잇따른 변경은 한 번으로 묶는다.
  const historyRef = useRef<RoomDraft[]>([]);
  const lastChangeRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [pickMode, setPickMode] = useState<PickMode>("corners");
  const [hint, setHint] = useState<string | null>(null);
  // 오른쪽 정보 칸 — 접으면 사진·미니어처를 넓게 쓴다
  const [panelOpen, setPanelOpen] = useState(true);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  useEffect(() => {
    if (shouldAutoOpenPanoramaTutorial()) queueMicrotask(() => setTutorialOpen(true));
  }, []);
  // 추천 표시용 — 높이를 확인했는지(고쳤거나 천장을 쟀거나, 저장된 방을 다시 열었으면), 도면 보기를 열어 봤는지
  const [heightChecked, setHeightChecked] = useState(initialDraft !== null);
  const [planVisited, setPlanVisited] = useState(false);
  const detection = useLayoutDetection();
  const detecting = detection.state.status === "running";

  const summary = useMemo(() => summarizeRoom(draft), [draft]);
  const validationError = validateRoomDraft(draft);
  const stageState = useMemo<RoomStageState>(
    () => ({
      outer: outerOfCorners(draft.corners, draft.cameraHeight),
      corners: draft.corners,
      inner: summary?.inner ?? [],
      cameraHeight: draft.cameraHeight,
      ceilingHeight: draft.ceilingHeight,
    }),
    [draft.corners, draft.cameraHeight, draft.ceilingHeight, summary],
  );

  const rememberDraft = useCallback((previous: RoomDraft) => {
    historyRef.current.push(previous);
    lastChangeRef.current = 0;
    setCanUndo(true);
  }, []);

  async function handleDetect() {
    setHint(null);
    // 이미 자동 인식으로 수평을 맞춘 사진이어도, 다시 찾을 땐 원래 장면 사진으로 한다.
    const result = await detection.detect(draft.sceneImageUrl);
    if (!result) return;
    const corners = floorCornersFromLayout(result.uv);
    rememberDraft(draft);
    setDraft((current) => withCeilingHeight({
      ...current,
      imageUrl: result.image_url,
      corners,
      layoutRatio: { z0: result.z0, z1: result.z1 },
    }, current.ceilingHeight));
    setView("photo");
    setPickMode("corners");
    setHint(`바닥 모서리 ${corners.length}개와 천장 비율을 찾았어요. 어긋난 점만 고치고, 실측값이 있으면 크기를 맞춰 보세요.`);
  }

  /** 모서리(와 안쪽 벽)를 바꾸고 되돌리기 기록에 남긴다 — 0.5초 안에 잇따른 변경(끌기)은 한 번으로 친다. */
  const changeShape = useCallback((corners: Vec2[], inner?: RoomDraft["inner"]) => {
    const now = Date.now();
    if (now - lastChangeRef.current > 500) {
      rememberDraft(draft);
    }
    lastChangeRef.current = now;
    setDraft((current) => ({ ...current, corners, inner: inner ?? current.inner }));
  }, [draft, rememberDraft]);

  const handleCornersChange = useCallback((corners: Vec2[]) => {
    setHint(null);
    changeShape(corners);
  }, [changeShape]);

  /**
   * 도면에서 고친 바닥 점(m) → 사진에서 본 방향(모서리 사진 좌표), 안쪽 벽은 촬영 높이 기준 값으로.
   * 그래서 촬영 높이를 바꿔도 모양이 유지된다.
   */
  const handlePlanChange = useCallback(({ outer, inner }: PlanShape) => {
    changeShape(outer.map(([x, z]) => directionToUv([x, -draft.cameraHeight, z])), innerToRelative(inner, draft.cameraHeight));
  }, [changeShape, draft.cameraHeight]);

  function handleScaleOuterWall(current: number, actual: number) {
    if (saving || detecting) return "작업이 끝난 뒤 다시 시도해 주세요.";
    const result = scaleRoomFromWall(draft, current, actual);
    if (!result.draft) return result.error;
    rememberDraft(draft);
    setDraft(result.draft);
    setHint(null);
    return null;
  }

  const handleCeilingPick = useCallback((uv: Vec2) => {
    const floorPoints = outerFromCorners(draft.corners, draft.cameraHeight) ?? [];
    const measured = measureCeilingHeight(uv, floorPoints, draft.cameraHeight);
    if (measured === null || measured <= draft.cameraHeight) {
      setHint("이미 찍은 바닥 모서리 바로 위의 천장 모서리를 눌러 주세요.");
      return;
    }
    if (!(measured >= MIN_CEILING_HEIGHT && measured <= MAX_CEILING_HEIGHT)) {
      setHint(`천장 높이가 ${MIN_CEILING_HEIGHT}~${MAX_CEILING_HEIGHT}m 범위를 벗어나요. 바닥 모서리 바로 위의 점을 다시 눌러 주세요.`);
      return;
    }
    const ceilingHeight = round(measured, 2);
    rememberDraft(draft);
    // 잰 결과도 "천장·바닥 거리 비율"이라, 이후엔 높이 하나를 바꾸면 다른 하나가 따라온다.
    setDraft({
      ...draft,
      ceilingHeight,
      layoutRatio: { z0: ceilingHeight - draft.cameraHeight, z1: -draft.cameraHeight },
    });
    setHint(`천장 높이를 ${ceilingHeight.toFixed(2)}m로 맞췄어요.`);
    setHeightChecked(true);
    setPickMode("corners");
  }, [draft, rememberDraft]);

  function undo() {
    const previous = historyRef.current.pop();
    setCanUndo(historyRef.current.length > 0);
    lastChangeRef.current = 0;
    if (previous) {
      setDraft(previous);
      setHint("방금 변경을 되돌렸어요.");
    }
  }

  function clearCorners() {
    if (draft.corners.length > 0) {
      rememberDraft(draft);
    }
    setDraft((current) => ({ ...current, corners: [], inner: [], layoutRatio: null, imageUrl: current.sceneImageUrl }));
    setView("photo");
    setPickMode("corners");
    setHint(null);
  }

  function toggleCeilingMeasure() {
    if (pickMode === "ceiling") {
      setPickMode("corners");
      setHint(null);
      return;
    }
    setView("photo");
    setPickMode("ceiling");
    setHint("이미 찍은 바닥 모서리 바로 위의 천장 모서리를 눌러 주세요.");
  }

  function openPlan() {
    setView("plan");
    setPickMode("corners");
    setPlanVisited(true);
    setHint(null);
  }

  const guide = view === "plan"
    ? "실제로 잰 바깥벽 하나를 눌러 길이를 넣으면, 사진을 바꾸지 않고 방 전체 크기를 맞춰요."
    : view === "walk"
    ? "화면을 끌어 천장을 확인해 보세요. 어긋나면 ‘천장 맞추기’로 고칠 수 있어요."
    : pickMode === "ceiling"
    ? "천장과 벽이 만나는 모서리를 눌러 주세요."
    : draft.corners.length < 3
      ? draft.corners.length === 0
        ? "바닥과 벽이 만나는 모서리를 차례대로 누르거나, 왼쪽 도구의 ‘자동 인식’을 눌러 보세요."
        : `바닥 모서리를 계속 눌러 주세요 (${draft.corners.length}개). 찍은 점은 끌어서 옮길 수 있어요.`
      : `모서리 ${draft.corners.length}개 — 미니어처로 방 모양을 확인해 보세요.`;

  async function handleSave() {
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

  const busy = detecting || saving;
  // 한 번 실행하는 동작 — 사진·미니어처에선 왼쪽 도구 막대, 도면 보기에선 도면 편집기 도구 막대에 넣는다
  const hasRoom = draft.corners.length >= 3;
  const actions: PlanTool[] = [
    {
      id: "detect",
      label: draft.corners.length > 0 ? "모서리 다시 자동으로 찾기" : "자동으로 모서리 찾기",
      caption: "자동 인식",
      hint: "사진에서 바닥 모서리를 찾아 줘요(10초쯤). 어긋난 점은 끌어서 고쳐요.",
      icon: IconWand,
      onClick: () => void handleDetect(),
      disabled: saving,
      busy: detecting,
    },
    { id: "undo", label: "되돌리기", caption: "되돌리기", hint: "방금 한 일을 취소해요.", icon: IconArrowBackUp, onClick: undo, disabled: busy || !canUndo },
    { id: "clear", label: "모서리 전체 지우기", caption: "전체 삭제", hint: "찍은 모서리와 안쪽 벽을 모두 지워요.", icon: IconEraser, onClick: () => setConfirmClear(true), disabled: busy || draft.corners.length === 0 },
  ];
  // '추천' 표시 — 모서리를 찾았으면 천장 높이 확인, 그다음 도면에서 다듬기
  const recommendCeiling = hasRoom && !draft.layoutRatio && !heightChecked;
  const recommendPlan = hasRoom && (!!draft.layoutRatio || heightChecked) && !planVisited;
  const statusText = saveError ?? (validationError && draft.corners.length >= 3 ? validationError : null);
  const status = detection.state.status === "running"
    ? detection.state.queued ? "차례를 기다리는 중이에요…" : "사진에서 방 모서리를 찾는 중이에요. 10초쯤 걸려요."
    : detection.state.status === "failed" ? detection.state.message : hint ?? guide;

  return (
    <div className="flex h-dvh min-h-[600px] w-full flex-col bg-white">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5">
        <Link href={backHref} aria-label={`${backLabel}(으)로 돌아가기`} title={`${backLabel}(으)로 돌아가기`} className="button button--outline button--sm button--icon">
          <IconArrowLeft size={16} stroke={2} aria-hidden />
        </Link>
        <div className="min-w-[120px] flex-1">
          <h1 className="truncate text-base font-bold leading-tight text-ink">{sceneLabel}</h1>
        </div>
        <ViewSwitch
          options={[
            { id: "photo", label: "사진 시점", icon: IconView360 },
            { id: "miniature", label: "미니어처", icon: IconCube, disabled: !summary },
            { id: "walk", label: "1인칭", icon: IconWalk, disabled: validationError !== null },
            { id: "plan", label: "도면", icon: IconLayoutBoard, disabled: !summary },
          ]}
          value={view}
          onChange={(next) => {
            if (next === "plan") {
              openPlan();
              return;
            }
            setView(next);
            setHint(null);
            if (next !== "photo") setPickMode("corners");
          }}
          className="order-3 w-full sm:order-2 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
        />
        {/* 좁은 화면에선 제목 줄 오른쪽에, 시점 바꾸기는 다음 줄 전체 폭으로 */}
        <div className="order-2 flex items-center gap-2 sm:order-3">
          <button type="button" onClick={() => setTutorialOpen(true)} aria-label="파노라마 방 만드는 법" title="파노라마 방 만드는 법" className="button button--outline button--sm">
            <IconHelp size={16} stroke={2} aria-hidden />
            <span className="hidden sm:inline">만드는 법</span>
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
          <RoomStageCanvas
            imageUrl={draft.imageUrl}
            state={stageState}
            view={view === "plan" ? "miniature" : view}
            pickMode={view === "photo" ? pickMode : "none"}
            onCornersChange={handleCornersChange}
            onCeilingPick={handleCeilingPick}
            onHint={setHint}
            className="h-full w-full"
          />
          {view === "plan" && summary && (
            <PlanEditor
              outer={summary.outer}
              inner={summary.inner}
              onChange={handlePlanChange}
              ceilingHeight={draft.ceilingHeight}
              modes={["none", "wall", "point"]}
              shortcutsEnabled={!tutorialOpen}
              actions={actions}
              onScaleOuterWall={handleScaleOuterWall}
              className="absolute inset-0"
            />
          )}
          {view !== "plan" && (
            <ToolRail label="모서리 편집 도구">
              <RailButton
                label="바닥 모서리 찍기"
                caption="모서리"
                hint="사진에서 바닥과 벽이 만나는 모서리를 차례대로 눌러요. 찍은 점은 끌어서 옮겨요."
                icon={IconVectorTriangle}
                active={view === "photo" && pickMode === "corners"}
                disabled={busy}
                onClick={() => {
                  setView("photo");
                  setPickMode("corners");
                  setHint(null);
                }}
              />
              <RailButton
                label="천장 맞추기"
                caption="천장"
                hint="바닥 모서리 바로 위의 천장 모서리를 누르면 천장 높이가 맞춰져요."
                icon={IconRuler2}
                active={view === "photo" && pickMode === "ceiling"}
                highlight={recommendCeiling}
                disabled={busy || !summary}
                onClick={toggleCeilingMeasure}
              />
              <RailButton
                label="도면에서 실제 크기 맞추기"
                caption="도면"
                hint="실제로 잰 바깥벽 하나의 길이로 방 전체 크기를 맞춰요. 치수를 모르면 건너뛰어도 돼요."
                icon={IconLayoutBoard}
                highlight={recommendPlan}
                disabled={busy || !summary}
                onClick={openPlan}
              />
              <RailDivider />
              <RailButton
                label={detecting ? "모서리 찾는 중…" : actions[0].label}
                caption="자동 인식"
                hint={actions[0].hint}
                icon={IconWand}
                highlight={draft.corners.length === 0}
                disabled={busy}
                onClick={() => void handleDetect()}
              />
              <RailButton label="되돌리기" caption="되돌리기" hint="방금 한 일을 취소해요." icon={IconArrowBackUp} disabled={busy || !canUndo} onClick={undo} />
              <RailButton label="모서리 전체 지우기" caption="전체 삭제" hint="찍은 모서리와 안쪽 벽을 모두 지워요." icon={IconEraser} disabled={busy || draft.corners.length === 0} onClick={() => setConfirmClear(true)} />
            </ToolRail>
          )}
          {view !== "plan" && (
            <p
              aria-live="polite"
              className="pointer-events-none absolute bottom-3 left-3 right-3 bg-black/65 px-3 py-2 text-[0.8125rem] text-white sm:right-auto sm:max-w-[520px]"
            >
              {status}
            </p>
          )}
        </div>

        {panelOpen && (
          <aside className="flex min-h-0 flex-col overflow-y-auto border-line lg:w-[340px] lg:shrink-0 lg:border-l">
            {(statusText || view === "plan") && (
              <div className="flex flex-col gap-1 border-b border-line bg-wash px-4 py-3 text-sm" aria-live="polite">
                {view === "plan" && <p className="text-ink">{status}</p>}
                {statusText && <p className={saveError ? "text-coral" : "text-soft"}>{saveError ? statusText : `저장하려면 — ${statusText}`}</p>}
              </div>
            )}

            {summary && (
              <Section title="크기와 천장 맞추기">
                <div className="flex flex-col gap-2.5">
                  <button type="button" onClick={openPlan} disabled={busy} className="button button--primary button--sm self-start">
                    <IconLayoutBoard size={16} aria-hidden /> 도면에서 실제 크기 맞추기
                  </button>
                  <p className="text-xs leading-relaxed text-soft">실제로 잰 바깥벽 하나의 길이를 넣으세요. 치수를 모르면 지금 크기로 저장해도 돼요.</p>
                  <button type="button" onClick={toggleCeilingMeasure} disabled={busy} className="button button--outline button--sm self-start">
                    <IconRuler2 size={16} aria-hidden /> {pickMode === "ceiling" ? "천장 맞추기 취소" : "사진에서 천장 맞추기"}
                  </button>
                  <p className="text-xs leading-relaxed text-soft">
                    {draft.layoutRatio
                      ? "사진에서 찾은 천장 비율을 적용했어요. 1인칭에서 어긋나 보일 때만 꼭짓점을 다시 찍으세요."
                      : "1인칭에서 천장이 어긋나면 바닥 모서리 바로 위의 천장 꼭짓점 하나를 찍으세요."}
                  </p>
                </div>
              </Section>
            )}

            <Section title="높이 직접 입력" summary={`천장 ${draft.ceilingHeight.toFixed(2)}m · 촬영 ${draft.cameraHeight.toFixed(2)}m`} defaultOpen={false}>
              <div className="flex gap-3">
                <HeightField
                  label="천장 높이"
                  value={draft.ceilingHeight}
                  min={MIN_CEILING_HEIGHT}
                  max={MAX_CEILING_HEIGHT}
                  disabled={busy}
                  onCommit={(value) => {
                    rememberDraft(draft);
                    setDraft((current) => withCeilingHeight(current, value));
                    setHeightChecked(true);
                  }}
                />
                <HeightField
                  label="촬영 높이"
                  value={draft.cameraHeight}
                  min={MIN_CAMERA_HEIGHT}
                  max={MAX_CAMERA_HEIGHT}
                  disabled={busy}
                  onCommit={(value) => {
                    rememberDraft(draft);
                    setDraft((current) => withCameraHeight(current, value));
                    setHeightChecked(true);
                  }}
                />
              </div>
              <p className="text-xs leading-relaxed text-soft">
                {draft.layoutRatio
                  ? "천장 높이만 맞추면 촬영 높이와 방 크기가 함께 정해져요."
                  : "방 크기는 사진을 찍은 높이(촬영 높이)에 비례해요. 보통 가슴 높이 1.5m 안팎이에요."}
              </p>
            </Section>

            <Section title="방 정보" summary={summary ? `${summary.areaM2.toFixed(1)}㎡ · 약 ${summary.areaPyeong.toFixed(1)}평` : undefined}>
              {summary ? (
                <>
                  <p className="text-2xl font-bold text-ink">
                    {summary.areaM2.toFixed(1)}㎡ <span className="text-base font-semibold text-soft">약 {summary.areaPyeong.toFixed(1)}평</span>
                  </p>
                  <p className="text-sm text-soft">천장 {draft.ceilingHeight.toFixed(2)}m</p>
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-ink">
                    {summary.wallLengths.map((length, index) => (
                      <li key={index} className="flex justify-between">
                        <span className="text-soft">벽 {index + 1}–{(index + 1) % summary.wallLengths.length + 1}</span>
                        {length.toFixed(2)}m
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-soft">바닥 모서리를 3개 이상 찍으면 면적과 벽 길이가 나와요.</p>
              )}
            </Section>

            <Section title="만드는 법" defaultOpen={false}>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-xs leading-relaxed text-soft">
                <li>도구는 화면 왼쪽 막대에 있어요. 마우스를 올리면 설명이 보이고, ‘추천’이 붙은 도구가 지금 쓰면 좋은 도구예요.</li>
                <li>‘자동으로 모서리 찾기’를 누르거나, 사진 시점에서 바닥과 벽이 만나는 모서리를 차례대로 눌러요. 찍은 점은 끌어서 옮겨요.</li>
                <li>‘도면’에서 바깥벽 하나의 실측 길이를 넣으면 전체 크기가 맞춰져요. 모양은 점을 끌어서 고쳐요.</li>
                <li>‘1인칭’에서 천장이 어긋나면 ‘천장 맞추기’로 바닥 모서리 바로 위의 천장 꼭짓점을 누르세요.</li>
              </ul>
            </Section>
          </aside>
        )}
      </div>
      {tutorialOpen && <PanoramaTutorial onClose={() => setTutorialOpen(false)} />}
      {confirmClear && (
        <ConfirmDialog
          title="모서리 전체 지우기"
          confirmLabel="전체 지우기"
          onConfirm={() => {
            setConfirmClear(false);
            clearCorners();
          }}
          onCancel={() => setConfirmClear(false)}
        >
          찍은 모서리와 안쪽 벽을 모두 지워요. 하나만 지우려면 ‘도면’에서 점이나 안쪽 벽을 고르고 ‘선택 삭제’나 Delete를 누르세요. 지운 뒤에도 ‘되돌리기’로 살릴 수 있어요.
        </ConfirmDialog>
      )}
    </div>
  );
}
