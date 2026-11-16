/**
 * 공간 사진 위 가구 배치 미리보기.
 *
 * 배치 결과는 저장하지 않는다 — 모달을 닫으면 사라진다. 사용자가 올린 가구 사진도 서버에 올리지 않고
 * 브라우저 안의 미리보기 URL(`URL.createObjectURL`)로만 쓴다.
 *
 * 위치·크기는 모두 사진 크기에 대한 비율(0~1)이라 화면 크기가 바뀌어도 사진의 같은 자리에 남는다.
 * 목록 순서가 곧 겹침 순서다 — 뒤에 있을수록 위에 그려진다.
 */

/** 사용자가 직접 올릴 수 있는 가구 사진 형식 — 다른 사진 업로드(`PhotoUpload`)와 같다. */
export const FURNITURE_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface FurnitureItem {
  id: string;
  name: string;
  src: string;
  /** 가구 가운데 위치 — 사진 너비·높이에 대한 비율. */
  x: number;
  y: number;
  /** 가구 너비 — 사진 너비에 대한 비율. 높이는 `aspect`로 정해진다. */
  width: number;
  /** 가구 사진의 가로 ÷ 세로. */
  aspect: number;
  /** 시계 방향 회전 각도(도). */
  rotation: number;
  flipped: boolean;
}

const MIN_FURNITURE_WIDTH = 0.03;
const MAX_FURNITURE_WIDTH = 1;
/** 새로 올린 가구의 기본 너비 — 사진 너비의 1/4. */
const DEFAULT_FURNITURE_WIDTH = 0.25;
/** 방향키 한 번에 움직이는 거리. */
export const KEYBOARD_MOVE_STEP = 0.01;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** 새 가구는 사진 가운데에 놓는다. */
export function createFurnitureItem({ name, src, aspect }: { name: string; src: string; aspect: number }): FurnitureItem {
  return {
    id: crypto.randomUUID(),
    name,
    src,
    x: 0.5,
    y: 0.5,
    width: DEFAULT_FURNITURE_WIDTH,
    aspect: Number.isFinite(aspect) && aspect > 0 ? aspect : 1,
    rotation: 0,
    flipped: false,
  };
}

export function moveFurniture(item: FurnitureItem, x: number, y: number): FurnitureItem {
  return { ...item, x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

export function resizeFurniture(item: FurnitureItem, width: number): FurnitureItem {
  return { ...item, width: clamp(width, MIN_FURNITURE_WIDTH, MAX_FURNITURE_WIDTH) };
}

/** 0 이상 360 미만으로 맞춘다. */
export function rotateFurniture(item: FurnitureItem, rotation: number): FurnitureItem {
  return { ...item, rotation: ((rotation % 360) + 360) % 360 };
}

export function flipFurniture(item: FurnitureItem): FurnitureItem {
  return { ...item, flipped: !item.flipped };
}

/** 겹침 순서를 한 칸 앞(+1)이나 뒤(-1)로 옮긴다. 이미 맨 앞·맨 뒤면 그대로 둔다. */
export function reorderFurniture(items: readonly FurnitureItem[], id: string, delta: 1 | -1): FurnitureItem[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * 실행 취소·다시 실행 기록.
 * 끌기·크기 조절·회전 중에는 `preview`로 화면만 바꾸고, 손을 뗄 때 `commit`으로 시작 시점 상태를 기록에 넣는다 —
 * 그래야 한 번의 끌기가 실행 취소 한 번으로 돌아간다.
 */
export interface FurnitureHistory {
  past: FurnitureItem[][];
  present: FurnitureItem[];
  future: FurnitureItem[][];
}

export type FurnitureHistoryAction =
  | { type: "add"; item: FurnitureItem }
  | { type: "apply"; items: FurnitureItem[] }
  | { type: "preview"; items: FurnitureItem[] }
  | { type: "commit"; before: FurnitureItem[] }
  | { type: "undo" }
  | { type: "redo" };

export const INITIAL_FURNITURE_HISTORY: FurnitureHistory = { past: [], present: [], future: [] };

export function furnitureHistoryReducer(state: FurnitureHistory, action: FurnitureHistoryAction): FurnitureHistory {
  switch (action.type) {
    // 사진을 불러오는 동안 다른 가구를 옮겼을 수 있어서, 그때 목록이 아니라 지금 목록 맨 위에 더한다.
    case "add":
      return { past: [...state.past, state.present], present: [...state.present, action.item], future: [] };
    case "apply":
      return { past: [...state.past, state.present], present: action.items, future: [] };
    case "preview":
      return { ...state, present: action.items };
    case "commit":
      // 눌렀다 바로 뗀 것(선택만 한 것)은 기록하지 않는다.
      if (action.before === state.present) return state;
      return { past: [...state.past, action.before], present: state.present, future: [] };
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future] };
    }
    case "redo": {
      const [next, ...rest] = state.future;
      if (!next) return state;
      return { past: [...state.past, state.present], present: next, future: rest };
    }
  }
}
