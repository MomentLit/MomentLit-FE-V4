"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { createLayoutJob, fetchLayoutJob, type LayoutJobResult } from "@/entities/room";
import { getErrorMessage } from "@/shared/api";

const POLL_INTERVAL_MS = 1500;
/** 서버 추론은 보통 10초 안팎 — 대기열까지 감안해 넉넉히 두되, 서버가 재시작돼 작업이 멈춘 경우엔 끊는다. */
const TIMEOUT_MS = 120_000;

export type DetectionState =
  | { status: "idle" }
  | { status: "running"; queued: boolean }
  | { status: "failed"; message: string };

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("aborted", "AbortError"));
    }, { once: true });
  });
}

/** 360° 사진 → 방 모서리 자동 찾기(서버 작업 + 폴링). 창을 닫으면 폴링을 멈춘다. */
export function useLayoutDetection() {
  const [state, setState] = useState<DetectionState>({ status: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const detect = useCallback(async (imageUrl: string): Promise<LayoutJobResult | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: "running", queued: true });

    try {
      let job = await createLayoutJob(imageUrl);
      const startedAt = Date.now();
      while (job.status === "QUEUED" || job.status === "RUNNING") {
        if (Date.now() - startedAt > TIMEOUT_MS) {
          throw new Error("모서리 찾기가 너무 오래 걸려요. 잠시 후 다시 시도하거나 직접 찍어 주세요.");
        }
        setState({ status: "running", queued: job.status === "QUEUED" });
        await sleep(POLL_INTERVAL_MS, controller.signal);
        job = await fetchLayoutJob(job.job_id, controller.signal);
      }
      if (job.status === "FAILED" || !job.result) {
        throw new Error(job.error ?? "방 구조를 찾지 못했어요. 모서리를 직접 찍어 주세요.");
      }
      setState({ status: "idle" });
      return job.result;
    } catch (error) {
      if (controller.signal.aborted || axios.isCancel(error)) return null;
      const message = axios.isAxiosError(error) && error.response?.status === 503
        ? "지금 요청이 많아요. 잠시 후 다시 시도하거나 모서리를 직접 찍어 주세요."
        : error instanceof Error && !axios.isAxiosError(error) ? error.message : getErrorMessage(error);
      setState({ status: "failed", message });
      return null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: "idle" });
  }, []);

  return { state, detect, cancel };
}
