"use client";

import { useState } from "react";
import { IconCube } from "@tabler/icons-react";
import type { PanoramaTourScene } from "@/widgets/panorama/model";
import { summarizeRoom, type RoomDraft } from "../model";
import { RoomBuilderModal } from "./RoomBuilderModal";

/**
 * 360° 장면 아래에 붙는 "3D 방" 칸 — 등록·수정 화면 공통.
 * 방은 여기서 저장하지 않고 초안만 들고 있다가, 부모가 공간을 저장할 때 함께 저장한다.
 */
export function RoomField({ scenes, value, onChange, title, disabled = false, saveHint = false }: {
  scenes: readonly PanoramaTourScene[];
  value: RoomDraft | null;
  onChange: (room: RoomDraft | null) => void;
  title: string;
  disabled?: boolean;
  saveHint?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (scenes.length === 0) return null;

  const summary = value ? summarizeRoom(value) : null;

  return (
    <div className="flex flex-col gap-2 border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <IconCube size={20} stroke={1.8} className="text-ink" aria-hidden />
        <span className="text-sm font-semibold text-ink">3D 방 (선택)</span>
        {summary && value && (
          <span className="text-sm text-soft">
            {summary.areaM2.toFixed(1)}㎡ · 약 {summary.areaPyeong.toFixed(1)}평 · 천장 {value.ceilingHeight.toFixed(2)}m
            {saveHint && " — 저장하면 반영돼요"}
          </span>
        )}
      </div>
      <p className="text-xs text-soft">
        360° 사진으로 실제 크기의 3D 방을 만들면, 손님이 공간을 미니어처로 둘러보고 가구를 놓아 볼 수 있어요.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="button button--outline">
          {value ? "3D 방 고치기" : "3D 방 만들기"}
        </button>
        {value && (
          <button type="button" disabled={disabled} onClick={() => onChange(null)} className="button button--danger">
            3D 방 빼기
          </button>
        )}
      </div>
      {open && (
        <RoomBuilderModal
          scenes={scenes}
          initialDraft={value}
          title={title}
          onClose={() => setOpen(false)}
          onConfirm={(draft) => {
            onChange(draft);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
