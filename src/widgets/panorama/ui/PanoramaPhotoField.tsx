"use client";

import { useState } from "react";
import { IconView360 } from "@tabler/icons-react";
import { FormField } from "@/widgets/registration-form/FormField";
import { PanoramaUploadModal } from "./PanoramaUploadModal";
import { PanoramaViewerModal } from "./PanoramaViewerModal";

/** Consistent 360° photo controls for both registration and editing. */
export function PanoramaPhotoField({ value, onChange, title, disabled = false, saveHint = false }: {
  value: string | null;
  onChange: (url: string | null) => void;
  title: string;
  disabled?: boolean;
  saveHint?: boolean;
}) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);

  return (
    <FormField label="360° 사진 (선택)" full hint="사진 한 장으로 공간을 둘러보게 하거나, 가이드에 따라 찍은 10장으로 360° 사진을 만들어 보세요.">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={disabled} onClick={() => setUploadOpen(true)} className="button button--outline">
          <IconView360 size={18} stroke={2} aria-hidden />
          {value ? "360° 사진 변경" : "360° 사진 추가"}
        </button>
        {value && (
          <>
            <button type="button" disabled={disabled} onClick={() => setViewerOpen(true)} className="button button--outline">미리보기</button>
            <button type="button" disabled={disabled} onClick={() => onChange(null)} className="button button--danger">사진 삭제</button>
            <span className="text-sm text-soft">{saveHint ? "저장하면 변경이 반영돼요" : "360° 사진이 준비됐어요"}</span>
          </>
        )}
      </div>
      {uploadOpen && (
        <PanoramaUploadModal onClose={() => setUploadOpen(false)} onConfirm={(url) => { onChange(url); setUploadOpen(false); }} />
      )}
      {viewerOpen && value && (
        <PanoramaViewerModal src={value} title={title} onClose={() => setViewerOpen(false)} />
      )}
    </FormField>
  );
}
