"use client";

import { useState } from "react";
import { IconCube } from "@tabler/icons-react";
import { MAX_ROOMS_PER_SPACE } from "@/entities/room";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import { roomPlacement, setRoomForScene, summarizeRoom, type RoomDraft } from "../model";
import { RoomBuilderModal } from "./RoomBuilderModal";

/**
 * 360° 장면 아래에 붙는 "3D 방" 칸 — 등록·수정 화면 공통. 장면마다 방을 하나씩 만들 수 있다.
 * 방은 여기서 저장하지 않고 초안만 들고 있다가, 부모가 공간을 저장할 때 함께 저장한다.
 */
export function RoomField({ scenes, value, onChange, title, disabled = false, saveHint = false }: {
  scenes: readonly PanoramaTourScene[];
  value: readonly RoomDraft[];
  onChange: (rooms: RoomDraft[]) => void;
  title: string;
  disabled?: boolean;
  saveHint?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  if (scenes.length === 0) return null;

  const editingScene = scenes.find((scene) => scene.image_url === editing);
  const limitReached = value.length >= MAX_ROOMS_PER_SPACE;

  return (
    <div className="flex flex-col gap-3 border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconCube size={20} stroke={1.8} className="text-ink" aria-hidden />
        <span className="text-sm font-semibold text-ink">3D 방 (선택)</span>
        <span className="text-sm text-soft">
          {value.length > 0 ? `${value.length}개 준비됨` : "장면마다 만들 수 있어요"}
          {saveHint && " — 저장하면 반영돼요"}
        </span>
      </div>
      <p className="text-xs text-soft">
        360° 사진으로 실제 크기의 3D 방을 만들면, 손님이 공간을 미니어처·1인칭으로 둘러보고 가구를 놓아 볼 수 있어요.
      </p>

      <ul className="flex flex-col divide-y divide-line border border-line">
        {scenes.map((scene, index) => {
          const room = value.find((item) => item.sceneImageUrl === scene.image_url) ?? null;
          const summary = room ? summarizeRoom(room) : null;
          const { name } = roomPlacement(scenes, scene.image_url);
          return (
            <li key={`${scene.image_url}-${index}`} className="flex flex-wrap items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                <span className="block text-xs text-soft">
                  {summary && room
                    ? `${summary.areaM2.toFixed(1)}㎡ · 약 ${summary.areaPyeong.toFixed(1)}평 · 천장 ${room.ceilingHeight.toFixed(2)}m`
                    : "아직 3D 방이 없어요"}
                </span>
              </div>
              <button
                type="button"
                disabled={disabled || (!room && limitReached)}
                onClick={() => setEditing(scene.image_url)}
                className="button button--outline"
              >
                {room ? "고치기" : "3D 방 만들기"}
              </button>
              {room && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(setRoomForScene(value, scene.image_url, null))}
                  className="button button--danger"
                >
                  빼기
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {editingScene && (
        <RoomBuilderModal
          scene={editingScene}
          sceneLabel={roomPlacement(scenes, editingScene.image_url).name}
          initialDraft={value.find((item) => item.sceneImageUrl === editingScene.image_url) ?? null}
          title={title}
          onClose={() => setEditing(null)}
          onConfirm={(draft) => {
            onChange(setRoomForScene(value, editingScene.image_url, draft));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
