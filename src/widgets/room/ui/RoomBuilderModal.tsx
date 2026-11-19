"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { IconArrowBackUp, IconCube, IconRefresh, IconRuler2, IconSparkles, IconView360, IconX } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import { floorCornersFromLayout, measureCeilingHeight, outerFromCorners, round, type Vec2 } from "../lib/geometry";
import { outerOfCorners, type PickMode, type RoomStageState, type RoomView } from "../lib/stage";
import {
  createRoomDraft,
  MAX_CAMERA_HEIGHT,
  MAX_CEILING_HEIGHT,
  MIN_CAMERA_HEIGHT,
  MIN_CEILING_HEIGHT,
  summarizeRoom,
  validateRoomDraft,
  withCameraHeight,
  withCeilingHeight,
  type RoomDraft,
} from "../model";
import { RoomStageCanvas } from "./RoomStageCanvas";
import { useLayoutDetection } from "./useLayoutDetection";

/** 높이 입력 — 타이핑 중엔 자유롭게 두고, 칸을 벗어나거나 Enter를 누를 때 범위 안으로 맞춰 반영한다. */
function HeightField({ label, value, min, max, onCommit, disabled }: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);

  function commit() {
    if (text === null) return;
    const parsed = Number(text);
    setText(null);
    if (Number.isFinite(parsed) && parsed > 0) onCommit(Math.max(min, Math.min(max, parsed)));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    }
  }

  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-semibold text-ink">
      {label}
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step={0.01}
          min={min}
          max={max}
          disabled={disabled}
          value={text ?? value.toFixed(2)}
          onChange={(event) => setText(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className={fieldInputClass}
        />
        <span className="text-soft">m</span>
      </span>
    </label>
  );
}

/**
 * 호스트가 360° 장면 하나로 실제 크기의 3D 방을 만드는 창.
 * 1) 바닥 모서리 찾기(자동 또는 직접 찍기) → 2) 높이 맞추기 → 3) 미니어처로 확인 후 정하기.
 * 저장은 하지 않고 초안을 부모에게 돌려준다 — 공간이 만들어진 뒤(등록) 또는 수정 저장 때 함께 저장한다.
 */
export function RoomBuilderModal({ scene, sceneLabel, initialDraft, title, onConfirm, onClose }: {
  scene: PanoramaTourScene;
  /** 화면에 보일 장면 이름(예: "거실", "장면 2"). */
  sceneLabel: string;
  initialDraft: RoomDraft | null;
  title: string;
  onConfirm: (draft: RoomDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<RoomDraft>(() => initialDraft ?? createRoomDraft(scene.image_url));
  const [view, setView] = useState<RoomView>("photo");
  const [pickMode, setPickMode] = useState<PickMode>("corners");
  const [hint, setHint] = useState<string | null>(null);
  const detection = useLayoutDetection();
  const detecting = detection.state.status === "running";

  const summary = useMemo(() => summarizeRoom(draft), [draft]);
  const validationError = validateRoomDraft(draft);
  const stageState = useMemo<RoomStageState>(
    () => ({
      outer: outerOfCorners(draft.corners, draft.cameraHeight),
      corners: draft.corners,
      inner: [],
      cameraHeight: draft.cameraHeight,
      ceilingHeight: draft.ceilingHeight,
    }),
    [draft.corners, draft.cameraHeight, draft.ceilingHeight],
  );

  async function handleDetect() {
    setHint(null);
    // 이미 자동 인식으로 수평을 맞춘 사진이어도, 다시 찾을 땐 원래 장면 사진으로 한다.
    const result = await detection.detect(draft.sceneImageUrl);
    if (!result) return;
    const corners = floorCornersFromLayout(result.uv);
    setDraft((current) => withCeilingHeight({
      ...current,
      imageUrl: result.image_url,
      corners,
      layoutRatio: { z0: result.z0, z1: result.z1 },
    }, current.ceilingHeight));
    setView("photo");
    setPickMode("corners");
    setHint(`모서리 ${corners.length}개를 찾았어요. 어긋난 점은 끌어서 고치고, 천장 높이를 맞춰 주세요.`);
  }

  const handleCornersChange = useCallback((corners: Vec2[]) => {
    setHint(null);
    setDraft((current) => ({ ...current, corners }));
  }, []);

  const handleCeilingPick = useCallback((uv: Vec2) => {
    const floorPoints = outerFromCorners(draft.corners, draft.cameraHeight) ?? [];
    const measured = measureCeilingHeight(uv, floorPoints, draft.cameraHeight);
    if (measured === null || measured <= draft.cameraHeight) {
      setHint("이미 찍은 바닥 모서리 바로 위의 천장 모서리를 눌러 주세요.");
      return;
    }
    const ceilingHeight = round(Math.max(MIN_CEILING_HEIGHT, Math.min(MAX_CEILING_HEIGHT, measured)), 2);
    // 잰 결과도 "천장·바닥 거리 비율"이라, 이후엔 높이 하나를 바꾸면 다른 하나가 따라온다.
    setDraft({
      ...draft,
      ceilingHeight,
      layoutRatio: { z0: ceilingHeight - draft.cameraHeight, z1: -draft.cameraHeight },
    });
    setHint(`천장 높이를 ${ceilingHeight.toFixed(2)}m로 맞췄어요.`);
    setPickMode("corners");
  }, [draft]);

  function undoCorner() {
    setDraft((current) => ({ ...current, corners: current.corners.slice(0, -1) }));
  }

  function clearCorners() {
    setDraft((current) => ({ ...current, corners: [], layoutRatio: null, imageUrl: current.sceneImageUrl }));
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

  const guide = pickMode === "ceiling"
    ? "천장과 벽이 만나는 모서리를 눌러 주세요."
    : draft.corners.length < 3
      ? `바닥과 벽이 만나는 모서리를 차례대로 눌러 주세요 (${draft.corners.length}개). 찍은 점은 끌어서 옮길 수 있어요.`
      : `모서리 ${draft.corners.length}개 — 미니어처로 방 모양을 확인해 보세요.`;

  return (
    <Modal
      label={`${title} 3D 방 만들기`}
      onClose={onClose}
      canClose={!detecting}
      panelClassName="flex w-full max-w-[1100px] flex-col gap-4 overflow-y-auto border border-line bg-white p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">3D Room</span>
          <h2 className="truncate section-title text-ink">3D 방 만들기 — {sceneLabel}</h2>
        </div>
        <button type="button" onClick={onClose} disabled={detecting} className="button button--outline shrink-0">
          <IconX size={18} stroke={2} aria-hidden />
          닫기
        </button>
      </div>

      <div className="relative">
        <RoomStageCanvas
          imageUrl={draft.imageUrl}
          state={stageState}
          view={view}
          pickMode={view === "photo" ? pickMode : "none"}
          onCornersChange={handleCornersChange}
          onCeilingPick={handleCeilingPick}
          onHint={setHint}
          className="h-[360px] sm:h-[480px]"
        />
        <div className="absolute right-3 top-3 flex gap-1" role="group" aria-label="시점">
          <button
            type="button"
            onClick={() => setView("photo")}
            aria-pressed={view === "photo"}
            className={cn("button min-h-9 px-3 py-1.5", view === "photo" ? "button--primary" : "button--outline")}
          >
            <IconView360 size={16} stroke={2} aria-hidden />
            사진 시점
          </button>
          <button
            type="button"
            onClick={() => setView("miniature")}
            disabled={!summary}
            aria-pressed={view === "miniature"}
            className={cn("button min-h-9 px-3 py-1.5", view === "miniature" ? "button--primary" : "button--outline")}
          >
            <IconCube size={16} stroke={2} aria-hidden />
            미니어처
          </button>
        </div>
      </div>

      <p className="text-sm text-soft" aria-live="polite">
        {detection.state.status === "running"
          ? detection.state.queued ? "차례를 기다리는 중이에요…" : "사진에서 방 모서리를 찾는 중이에요. 10초쯤 걸려요."
          : detection.state.status === "failed" ? detection.state.message : hint ?? guide}
      </p>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="모서리 편집">
        <button type="button" onClick={handleDetect} disabled={detecting} className="button button--outline">
          <IconSparkles size={18} stroke={2} aria-hidden />
          {detecting ? "찾는 중…" : "자동으로 모서리 찾기"}
        </button>
        <span className="mx-1 h-6 w-px bg-line" aria-hidden />
        <button type="button" onClick={undoCorner} disabled={detecting || draft.corners.length === 0} className="button button--outline">
          <IconArrowBackUp size={18} stroke={2} aria-hidden />
          하나 되돌리기
        </button>
        <button type="button" onClick={clearCorners} disabled={detecting || draft.corners.length === 0} className="button button--outline">
          <IconRefresh size={18} stroke={2} aria-hidden />
          처음부터
        </button>
        <button
          type="button"
          onClick={toggleCeilingMeasure}
          disabled={detecting || draft.corners.length === 0}
          aria-pressed={pickMode === "ceiling"}
          className={cn("button", pickMode === "ceiling" ? "button--primary" : "button--outline")}
        >
          <IconRuler2 size={18} stroke={2} aria-hidden />
          {pickMode === "ceiling" ? "재기 그만두기" : "천장 모서리를 눌러 재기"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <HeightField
              label="천장 높이"
              value={draft.ceilingHeight}
              min={MIN_CEILING_HEIGHT}
              max={MAX_CEILING_HEIGHT}
              disabled={detecting}
              onCommit={(value) => setDraft((current) => withCeilingHeight(current, value))}
            />
            <HeightField
              label="촬영 높이"
              value={draft.cameraHeight}
              min={MIN_CAMERA_HEIGHT}
              max={MAX_CAMERA_HEIGHT}
              disabled={detecting}
              onCommit={(value) => setDraft((current) => withCameraHeight(current, value))}
            />
          </div>
          <p className="text-xs text-soft">
            {draft.layoutRatio
              ? "천장 높이만 맞추면 촬영 높이와 방 크기가 함께 정해져요."
              : "방 크기는 사진을 찍은 높이(촬영 높이)에 비례해요. 보통 가슴 높이 1.5m 안팎이에요."}
          </p>
        </div>

        <div className="border border-line p-4">
          {summary ? (
            <>
              <p className="text-2xl font-bold text-ink">
                {summary.areaM2.toFixed(1)}㎡ <span className="text-base font-semibold text-soft">약 {summary.areaPyeong.toFixed(1)}평</span>
              </p>
              <p className="text-sm text-soft">천장 {draft.ceilingHeight.toFixed(2)}m</p>
              <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm text-ink">
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
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {validationError && draft.corners.length >= 3 && <span className="mr-auto text-sm text-soft">{validationError}</span>}
        <button type="button" onClick={onClose} disabled={detecting} className="button button--outline">취소</button>
        <button
          type="button"
          onClick={() => onConfirm(draft)}
          disabled={detecting || validationError !== null}
          className="button button--primary"
        >
          이 방으로 정하기
        </button>
      </div>
    </Modal>
  );
}
