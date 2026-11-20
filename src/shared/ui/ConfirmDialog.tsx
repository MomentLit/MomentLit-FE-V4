"use client";

import type { ReactNode } from "react";
import { Modal } from "./Modal";

/**
 * 되돌릴 수 없는 동작(삭제 등) 전에 한 번 묻는 작은 모달. Esc·배경 클릭·취소로 닫힌다(진행 중에는 닫히지 않음).
 * 확인 버튼에 처음 초점이 가지 않게 취소를 먼저 둔다.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  cancelLabel = "취소",
  tone = "danger",
  busy = false,
  error = null,
  onConfirm,
  onCancel,
}: {
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  /** 진행 중일 때 확인 버튼 글자(예: "지우는 중…"). */
  busyLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      label={title}
      onClose={onCancel}
      canClose={!busy}
      panelClassName="flex w-full max-w-[420px] flex-col gap-4 border border-line bg-white p-6"
    >
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {children && <div className="text-sm leading-relaxed text-soft">{children}</div>}
      {error && <p className="text-sm text-coral" role="alert">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className="button button--outline">
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={tone === "danger" ? "button button--danger" : "button button--primary"}
        >
          {busy && busyLabel ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
