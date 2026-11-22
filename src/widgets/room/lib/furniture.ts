/**
 * 3D 방에 놓는 가구 목록(실제 크기, m). id는 서버에 저장되는 값이라 바꾸면 저장된 배치가 사라진다.
 * - 기본 가구: 모양(three.js 메시)은 stage.ts의 `buildFurniture`가 같은 id로 만든다.
 * - 모델 가구(`ph-`로 시작, Poly Haven 가구): Poly Haven API 목록 전체(`registerPolyHavenFurniture`). 썸네일만 먼저 보이고,
 *   놓을 때 Poly Haven에서 glTF를 받는다(`polyHavenId`).
 * - GLB 주소(`model`)가 있는 가구는 그 파일을 그대로 쓴다.
 */
export interface FurnitureDef {
  id: string;
  name: string;
  /** 가로(x) */
  width: number;
  /** 세로(z) */
  depth: number;
  /** 높이(y). 모델 가구만 — 모델을 받는 동안 보이는 상자 높이. */
  height?: number;
  /** GLB 주소(절대 URL) — 바닥 가운데가 원점, 앞이 +z, 단위 m인 모델. */
  model?: string;
  /** Poly Haven 에셋 id(대소문자 그대로) — `model`이 없으면 놓을 때 Poly Haven에서 받는다. */
  polyHavenId?: string;
  /** 찾기용 낱말(Poly Haven 태그 등). */
  tags?: readonly string[];
  /** 팔레트 썸네일(절대 URL). */
  thumbnail?: string;
  category?: FurnitureCategory;
  /** 어디에 놓나 — 바닥(기본, 작으면 가구 위에도) / 벽에 건다 / 천장에 단다. */
  mount?: FurnitureMount;
}

export type FurnitureMount = "floor" | "wall" | "ceiling";

export type FurnitureCategory = "seating" | "table" | "bed" | "storage" | "lighting" | "electronics" | "decor" | "props";

/** Poly Haven 가구 id 접두사(`ph-<에셋 id 소문자-하이픈>`). */
export const MODEL_FURNITURE_PREFIX = "ph-";

export function isModelFurnitureId(id: string): boolean {
  return id.startsWith(MODEL_FURNITURE_PREFIX);
}

export const FURNITURE_CATALOG: readonly FurnitureDef[] = [
  { id: "sofa-3", name: "3인 소파", width: 2.1, depth: 0.9, height: 0.92 },
  { id: "bed-queen", name: "퀸 침대", width: 1.6, depth: 2.1, height: 1.0 },
  { id: "desk", name: "책상", width: 1.2, depth: 0.6, height: 0.75 },
  { id: "chair", name: "의자", width: 0.45, depth: 0.5, height: 0.93 },
  { id: "table-4", name: "4인 식탁", width: 1.4, depth: 0.8, height: 0.75 },
  { id: "wardrobe", name: "옷장", width: 1.2, depth: 0.6, height: 2.0 },
  { id: "tv-stand", name: "TV장과 TV", width: 1.8, depth: 0.4, height: 1.21 },
  { id: "plant", name: "화분", width: 0.4, depth: 0.4, height: 1.15 },
];

const polyHavenFurniture = new Map<string, FurnitureDef>();

/** Poly Haven API 목록에서 받은 가구. */
export function registerPolyHavenFurniture(defs: readonly FurnitureDef[]) {
  for (const def of defs) polyHavenFurniture.set(def.id, def);
}

export function findFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE_CATALOG.find((def) => def.id === id) ?? polyHavenFurniture.get(id);
}

/** 가구 모양을 어디서 받는지 — 바뀌면 무대가 다시 만든다. 기본 도형 가구는 null. */
export function furnitureModelKey(def: FurnitureDef | undefined): string | null {
  if (def?.model) return def.model;
  if (def?.polyHavenId) return `polyhaven:${def.polyHavenId}`;
  return null;
}

/**
 * 서버·브라우저에 저장된 배치에서 지금 목록에 없는 가구는 뺀다.
 * 모델 가구는 카탈로그를 받기 전일 수 있어서 남겨 둔다(받기 전엔 상자로 보인다).
 */
export function knownFurniture<T extends { type: string }>(items: readonly T[]): T[] {
  return items.filter((item) => findFurniture(item.type) || isModelFurnitureId(item.type));
}

/** 각도를 -π~π로 맞춘다(서버는 ±7 라디안까지 받는다). */
export function normalizeRotation(rotation: number): number {
  const twoPi = Math.PI * 2;
  return ((((rotation + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

export function furnitureMount(def: FurnitureDef | undefined): FurnitureMount {
  return def?.mount ?? "floor";
}

/** 가구 위(윗면·선반 칸)에 올릴 수 있는 작은 바닥 물건인지 — 소파·침대 같은 큰 가구가 끌다가 탁자 위로 올라타지 않게. */
export function isStackable(def: FurnitureDef | undefined): boolean {
  if (!def || furnitureMount(def) !== "floor") return false;
  return Math.max(def.width, def.depth) <= 1.0 && (def.height ?? 1) <= 1.3;
}
