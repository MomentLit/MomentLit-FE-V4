"use client";

import { useState } from "react";
import { IconView360 } from "@tabler/icons-react";
import { FormField } from "@/widgets/registration-form/FormField";
import type { PanoramaTourScene } from "../model";
import { PanoramaTourEditor } from "./PanoramaTourEditor";
import { PanoramaUploadModal } from "./PanoramaUploadModal";
import { PanoramaViewerModal } from "./PanoramaViewerModal";

/** 업로드 모달이 채울 자리 — 새 장면을 뒤에 붙이거나, 그 순서의 장면 사진을 바꾼다. */
type UploadTarget = "NEW" | number;

/** Consistent 360° scene controls for both registration and editing. */
export function PanoramaPhotoField({ value, onChange, title, disabled = false, saveHint = false }: {
  value: PanoramaTourScene[];
  onChange: (scenes: PanoramaTourScene[]) => void;
  title: string;
  disabled?: boolean;
  saveHint?: boolean;
}) {
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  function handleUploaded(url: string) {
    if (uploadTarget === "NEW") {
      onChange([...value, { image_url: url, name: "" }]);
    } else if (uploadTarget !== null) {
      onChange(value.map((scene, index) => (index === uploadTarget ? { ...scene, image_url: url } : scene)));
    }
    setUploadTarget(null);
  }

  return (
    <FormField
      label="360° 사진 (선택)"
      full
      hint="사진 한 장으로 공간을 둘러보게 하거나, 가이드에 따라 찍은 10장으로 360° 사진을 만들어 보세요. 여러 장을 넣으면 장면마다 이동 화살표를 추가해 바닥 화살표로 다른 장소에 이동할 수 있어요 — 화살표 방향은 사진에서 직접 눌러 정해요. 첫 장면이 시작 장면이에요."
    >
      {value.length > 0 && (
        <PanoramaTourEditor scenes={value} onChange={onChange} onReplacePhoto={setUploadTarget} disabled={disabled} />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => setUploadTarget("NEW")} className="button button--outline">
          <IconView360 size={18} stroke={2} aria-hidden />
          {value.length > 0 ? "360° 장면 추가" : "360° 사진 추가"}
        </button>
        {value.length > 0 && (
          <>
            <button type="button" disabled={disabled} onClick={() => setViewerOpen(true)} className="button button--outline">미리보기</button>
            <button type="button" disabled={disabled} onClick={() => onChange([])} className="button button--danger">전체 삭제</button>
            <span className="text-sm text-soft">{saveHint ? "저장하면 변경이 반영돼요" : `360° 장면 ${value.length}개가 준비됐어요`}</span>
          </>
        )}
      </div>
      {uploadTarget !== null && (
        <PanoramaUploadModal onClose={() => setUploadTarget(null)} onConfirm={handleUploaded} />
      )}
      {viewerOpen && value.length > 0 && (
        <PanoramaViewerModal scenes={value} title={title} onClose={() => setViewerOpen(false)} />
      )}
    </FormField>
  );
}
