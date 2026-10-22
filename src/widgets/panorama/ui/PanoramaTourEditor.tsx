"use client";

import "@photo-sphere-viewer/core/index.css";
import { useEffect, useRef, useState } from "react";
import { IconArrowDown, IconArrowUp, IconPlus, IconRefresh } from "@tabler/icons-react";
import type { Viewer } from "@photo-sphere-viewer/core";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import { Modal } from "@/shared/ui/Modal";
import {
  formatPanoramaYaw,
  getPanoramaSceneName,
  movePanoramaScene,
  normalizeYaw,
  removePanoramaScene,
  removePanoramaSceneLink,
  setPanoramaSceneLink,
  type PanoramaTourScene,
} from "../model";

export interface PanoramaTourEditorProps {
  scenes: readonly PanoramaTourScene[];
  onChange: (scenes: PanoramaTourScene[]) => void;
  /** 이 순서의 장면 사진을 다시 고른다(업로드 모달은 부모가 띄운다). */
  onReplacePhoto: (index: number) => void;
  disabled?: boolean;
}

/** 방향 지정 창이 다루는 화살표 — `targetIndex`가 null이면 새 화살표(도착 장면을 아직 고르지 않음). */
interface LinkDraft {
  from: number;
  targetIndex: number | null;
  yaw: number | null;
}

/**
 * 360도 장면 목록 — 이름, 순서, 사진 바꾸기, 삭제, 이동 화살표.
 * 첫 장면이 시작 장면이고, 장면마다 다른 장면으로 가는 화살표를 여러 개 둘 수 있다.
 * 화살표를 추가하면 도착 장면에 돌아오는 화살표가 반대 방향으로 자동으로 생긴다(`setPanoramaSceneLink`).
 */
export function PanoramaTourEditor({ scenes, onChange, onReplacePhoto, disabled }: PanoramaTourEditorProps) {
  const [draft, setDraft] = useState<LinkDraft | null>(null);

  function update(index: number, name: string) {
    onChange(scenes.map((scene, i) => (i === index ? { ...scene, name } : scene)));
  }

  function move(index: number, offset: -1 | 1) {
    onChange(movePanoramaScene(scenes, index, offset));
  }

  function remove(index: number) {
    onChange(removePanoramaScene(scenes, index));
  }

  function saveLink(from: number, to: number, yaw: number) {
    onChange(setPanoramaSceneLink(scenes, from, to, yaw));
    setDraft(null);
  }

  return (
    <>
      <ol className="flex flex-col gap-2">
        {scenes.map((scene, index) => {
          const links = scene.links ?? [];
          const canAddLink = scenes.some((_, i) => i !== index && !links.some((link) => link.targetIndex === i));

          return (
            <li key={`${scene.image_url}-${index}`} className="flex flex-col gap-2 border border-line px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[0.72rem] font-medium text-soft">{String(index + 1).padStart(2, "0")}</span>
                <input
                  type="text"
                  value={scene.name ?? ""}
                  onChange={(e) => update(index, e.target.value)}
                  placeholder={getPanoramaSceneName({ image_url: scene.image_url }, index)}
                  disabled={disabled}
                  aria-label={`${index + 1}번 장면 이름`}
                  className={`${fieldInputClass} min-w-0 flex-1 basis-40`}
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={disabled || index === 0}
                    aria-label={`${index + 1}번 장면을 앞으로`}
                    className="button button--outline"
                  >
                    <IconArrowUp size={16} stroke={2} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={disabled || index === scenes.length - 1}
                    aria-label={`${index + 1}번 장면을 뒤로`}
                    className="button button--outline"
                  >
                    <IconArrowDown size={16} stroke={2} aria-hidden />
                  </button>
                  <button type="button" onClick={() => onReplacePhoto(index)} disabled={disabled} className="button button--outline">
                    <IconRefresh size={16} stroke={2} aria-hidden />
                    사진 변경
                  </button>
                  <button type="button" onClick={() => remove(index)} disabled={disabled} className="button button--danger">
                    삭제
                  </button>
                </div>
              </div>

              {scenes.length > 1 && (
                <div className="flex flex-col gap-1.5 pl-6">
                  {links.map((link) => (
                    <div key={link.targetIndex} className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 text-ink">
                        → {getPanoramaSceneName(scenes[link.targetIndex], link.targetIndex)}
                        <span className="ml-2 text-soft">{formatPanoramaYaw(link.yaw)}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraft({ from: index, targetIndex: link.targetIndex, yaw: link.yaw })}
                        disabled={disabled}
                        className="button button--outline"
                      >
                        방향 변경
                      </button>
                      <button
                        type="button"
                        onClick={() => onChange(removePanoramaSceneLink(scenes, index, link.targetIndex))}
                        disabled={disabled}
                        className="button button--danger"
                      >
                        화살표 삭제
                      </button>
                    </div>
                  ))}
                  <div>
                    <button
                      type="button"
                      onClick={() => setDraft({ from: index, targetIndex: null, yaw: null })}
                      disabled={disabled || !canAddLink}
                      className="button button--outline"
                    >
                      <IconPlus size={16} stroke={2} aria-hidden />
                      이동 화살표 추가
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {draft && (
        <PanoramaLinkDirectionModal
          scenes={scenes}
          draft={draft}
          onClose={() => setDraft(null)}
          onConfirm={saveLink}
        />
      )}
    </>
  );
}

/**
 * 이동 화살표 방향 지정 — 출발 장면의 360° 사진에서 화살표를 둘 곳을 누르면 그 수평 방향(yaw)을 쓴다.
 * 위아래 각도는 쓰지 않는다(화살표는 바닥에 놓인다). 고른 방향은 가운데 표시에 오도록 돌려서 보여준다.
 */
function PanoramaLinkDirectionModal({ scenes, draft, onClose, onConfirm }: {
  scenes: readonly PanoramaTourScene[];
  draft: LinkDraft;
  onClose: () => void;
  onConfirm: (from: number, to: number, yaw: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(draft.targetIndex);
  const [yaw, setYaw] = useState<number | null>(draft.yaw);
  const [error, setError] = useState<string | null>(null);

  const fromScene = scenes[draft.from];
  const fromName = getPanoramaSceneName(fromScene, draft.from);
  const isNew = draft.targetIndex === null;
  const existingTargets = new Set((fromScene.links ?? []).map((link) => link.targetIndex));
  const targetOptions = scenes
    .map((scene, index) => ({ index, name: getPanoramaSceneName(scene, index) }))
    .filter(({ index }) => index !== draft.from && !existingTargets.has(index));

  const imageUrl = fromScene.image_url;
  const initialYaw = draft.yaw;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let viewer: Viewer | null = null;
    let cancelled = false;
    queueMicrotask(() => setError(null));

    import("@photo-sphere-viewer/core")
      .then(({ Viewer }) => {
        if (cancelled) return;
        viewer = new Viewer({
          container,
          navbar: ["zoom", "move"],
          loadingTxt: "360° 사진을 불러오는 중…",
          defaultYaw: initialYaw ?? 0,
        });
        viewer.addEventListener("click", ({ data }) => {
          if (data.rightclick) return;
          const picked = normalizeYaw(data.yaw);
          setYaw(picked);
          viewer?.rotate({ yaw: picked, pitch: 0 });
        });
        // `PanoramaViewer`와 같이 불러오기 실패를 직접 받아서 우리 안내 문구를 보여준다.
        viewer.setPanorama(imageUrl).catch(() => {
          if (cancelled) return;
          viewer?.destroy();
          viewer = null;
          setError("360° 사진을 불러오지 못했어요.");
        });
      })
      .catch(() => {
        if (!cancelled) setError("360° 뷰어를 불러오지 못했어요.");
      });

    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [imageUrl, initialYaw]);

  const canConfirm = targetIndex !== null && yaw !== null;

  return (
    <Modal label={`${fromName} 이동 화살표 방향`} onClose={onClose} panelClassName="flex w-full max-w-[960px] flex-col gap-4 overflow-y-auto border border-line bg-white p-5">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">Arrow Direction</span>
        <h2 className="section-title text-ink">{fromName}에서 이동할 방향</h2>
        <p className="text-sm text-soft">
          사진에서 화살표를 둘 곳을 눌러 주세요. 처음 추가하면 도착 장면에도 돌아오는 화살표가 반대 방향으로 생겨요.
        </p>
      </div>

      {isNew ? (
        <select
          value={targetIndex ?? ""}
          onChange={(e) => setTargetIndex(e.target.value === "" ? null : Number(e.target.value))}
          aria-label="이동할 장면"
          className={fieldInputClass}
        >
          <option value="">이동할 장면을 골라 주세요</option>
          {targetOptions.map(({ index, name }) => (
            <option key={index} value={index}>{name}</option>
          ))}
        </select>
      ) : (
        targetIndex !== null && (
          <p className="text-sm text-ink">→ {getPanoramaSceneName(scenes[targetIndex], targetIndex)}</p>
        )
      )}

      <div className="relative h-[min(55dvh,520px)] shrink-0 overflow-hidden bg-ink">
        <div ref={containerRef} className="absolute inset-0" />
        {yaw !== null && !error && (
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white" />
        )}
        {error && (
          <p role="alert" className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-soft">{yaw === null ? "방향을 아직 고르지 않았어요" : `선택한 방향: ${formatPanoramaYaw(yaw)}`}</span>
        <div className="flex gap-1.5">
          <button type="button" onClick={onClose} className="button button--outline">취소</button>
          <button
            type="button"
            onClick={() => {
              if (targetIndex !== null && yaw !== null) onConfirm(draft.from, targetIndex, yaw);
            }}
            disabled={!canConfirm}
            className="button button--primary"
          >
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}
