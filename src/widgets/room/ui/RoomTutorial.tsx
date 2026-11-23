"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconArrowLeft, IconArrowRight, IconX } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";

export interface RoomTutorialStep {
  title: string;
  body: ReactNode;
  image: (reducedMotion: boolean) => ReactNode;
}

export function shouldAutoOpenRoomTutorial(seenKey: string) {
  try {
    return window.localStorage.getItem(seenKey) === null;
  } catch {
    return false;
  }
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function RoomTutorial({ label, seenKey, steps, onClose }: {
  label: string;
  seenKey: string;
  steps: readonly [RoomTutorialStep, ...RoomTutorialStep[]];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const reduced = useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
  const step = steps[index];
  const last = index === steps.length - 1;

  function close() {
    try {
      window.localStorage.setItem(seenKey, "1");
    } catch {
      onClose();
      return;
    }
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((current) => Math.min(current + 1, steps.length - 1));
      else if (event.key === "ArrowLeft") setIndex((current) => Math.max(current - 1, 0));
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [steps.length]);

  return (
    <Modal label={label} onClose={close} panelClassName="flex w-full max-w-[520px] flex-col gap-4 overflow-y-auto border border-line bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.18em] text-soft">
          {label} · {index + 1}/{steps.length}
        </span>
        <button type="button" onClick={close} aria-label="닫기" className="button button--outline button--sm button--icon">
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </div>
      <div key={index} className="aspect-[8/5] w-full shrink-0 border border-line bg-wash p-2">
        {step.image(reduced)}
      </div>
      <div className="flex min-h-[104px] flex-col gap-1.5" aria-live="polite">
        <h2 className="text-base font-bold text-ink">{step.title}</h2>
        <p className="text-sm leading-relaxed text-soft">{step.body}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="단계">
          {steps.map((item, stepIndex) => (
            <button
              key={item.title}
              type="button"
              role="tab"
              aria-selected={stepIndex === index}
              aria-label={`${stepIndex + 1}. ${item.title}`}
              onClick={() => setIndex(stepIndex)}
              className={cn("h-2 transition-all motion-reduce:transition-none", stepIndex === index ? "w-5 bg-ink" : "w-2 bg-line-2 hover:bg-soft")}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} className="button button--outline button--sm">
              <IconArrowLeft size={15} stroke={2} aria-hidden /> 이전
            </button>
          )}
          {last ? (
            <button type="button" onClick={close} className="button button--primary button--sm">시작하기</button>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)} className="button button--primary button--sm">
              다음 <IconArrowRight size={15} stroke={2} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
