/**
 * 3D 방에 놓는 가구 목록(실제 크기, m). id는 서버에 저장되는 값이라 바꾸면 저장된 배치가 사라진다.
 * 모양(three.js 메시)은 stage.ts의 `buildFurniture`가 같은 id로 만든다.
 */
export interface FurnitureDef {
  id: string;
  name: string;
  /** 가로(x) */
  width: number;
  /** 세로(z) */
  depth: number;
}

export const FURNITURE_CATALOG: readonly FurnitureDef[] = [
  { id: "sofa-3", name: "3인 소파", width: 2.1, depth: 0.9 },
  { id: "bed-queen", name: "퀸 침대", width: 1.6, depth: 2.1 },
  { id: "desk", name: "책상", width: 1.2, depth: 0.6 },
  { id: "chair", name: "의자", width: 0.45, depth: 0.5 },
  { id: "table-4", name: "4인 식탁", width: 1.4, depth: 0.8 },
  { id: "wardrobe", name: "옷장", width: 1.2, depth: 0.6 },
  { id: "tv-stand", name: "TV장과 TV", width: 1.8, depth: 0.4 },
  { id: "plant", name: "화분", width: 0.4, depth: 0.4 },
];

export function findFurniture(id: string): FurnitureDef | undefined {
  return FURNITURE_CATALOG.find((def) => def.id === id);
}

/** 서버·브라우저에 저장된 배치에서 지금 목록에 없는 가구는 뺀다. */
export function knownFurniture<T extends { type: string }>(items: readonly T[]): T[] {
  return items.filter((item) => findFurniture(item.type));
}

/** 각도를 -π~π로 맞춘다(서버는 ±7 라디안까지 받는다). */
export function normalizeRotation(rotation: number): number {
  const twoPi = Math.PI * 2;
  return ((((rotation + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}
