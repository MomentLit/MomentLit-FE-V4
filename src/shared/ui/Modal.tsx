"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Shared overlay for photo tools, with keyboard dismissal and focus containment. */
export function Modal({
  label,
  onClose,
  canClose = true,
  children,
  panelClassName = "flex w-full max-w-[760px] flex-col gap-6 overflow-y-auto border border-line bg-white p-5 sm:p-8",
}: {
  label: string;
  onClose: () => void;
  canClose?: boolean;
  children: ReactNode;
  panelClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef({ onClose, canClose });

  useEffect(() => {
    closeRef.current = { onClose, canClose };
  }, [onClose, canClose]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function focusableElements() {
      return Array.from(panel!.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getClientRects().length > 0);
    }

    (focusableElements()[0] ?? panel).focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (closeRef.current.canClose) closeRef.current.onClose();
      }
      if (event.key !== "Tab") return;
      const elements = focusableElements();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) {
        event.preventDefault();
        panel!.focus();
      } else if (event.shiftKey && (document.activeElement === first || !elements.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !elements.includes(document.activeElement as HTMLElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  // A mode change can remove the currently focused button from the DOM.
  // Run after mount setup so we first remember the element outside the modal.
  useEffect(() => {
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus();
  });

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/60 p-4 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget && canClose) onClose();
      }}
    >
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className={`max-h-[calc(100dvh-32px)] ${panelClassName}`}>
        {children}
      </div>
    </div>
  );
}
