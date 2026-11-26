/**
 * 실행 취소(⌘Z)·다시 실행(⌘⇧Z) 기록. 화면에 그리는 값(`present`)과 그 앞뒤 기록을 한 덩어리로 들고 있어
 * React 상태 갱신 함수 안에서 그대로 쓸 수 있다(순수 함수 — 부수 효과 없음).
 */
export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

/** 기록을 이만큼만 남긴다 — 오래된 것부터 버린다. */
export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/**
 * 값을 바꾼다. `record`면 바꾸기 전 값을 되돌릴 자리로 남기고(다시 실행 기록은 버린다),
 * 아니면 지금 단계에 합친다(끌기 중간 움직임·자동으로 내려앉히기처럼 한 동작의 일부).
 * 값이 그대로면 아무것도 남기지 않는다.
 */
export function applyHistory<T>(history: History<T>, next: T, record: boolean): History<T> {
  if (Object.is(next, history.present)) return history;
  if (!record) return { ...history, present: next };
  const past = [...history.past, history.present];
  return { past: past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past, present: next, future: [] };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...future] = history.future;
  return { past: [...history.past, history.present], present: next, future };
}
