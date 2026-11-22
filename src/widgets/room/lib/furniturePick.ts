import type * as Three from "three";

/**
 * 가구 자신의 좌표로 본 상자(회전·위치 전). 모델이 바뀌면 `userData.localBox`를 지워 다시 잰다.
 */
export function localFurnitureBox(three: typeof Three, object: Three.Object3D): Three.Box3 {
  const cached = object.userData.localBox as Three.Box3 | undefined;
  if (cached) return cached;
  object.updateMatrixWorld(true);
  const inverse = object.matrixWorld.clone().invert();
  const box = new three.Box3();
  object.traverse((child) => {
    const mesh = child as Three.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld.clone().premultiply(inverse)));
  });
  object.userData.localBox = box;
  return box;
}

/**
 * 광선이 맞는 가구 상자(가구 회전을 따라감) 중 가장 가까운 가구의 `userData.index`.
 * 모델의 빈 곳(의자 등받이 사이, 선반 칸)을 눌러도 가구를 고를 수 있게 메시 판정이 빗나갔을 때 쓴다.
 */
export function nearestFurnitureBox(three: typeof Three, ray: Three.Ray, objects: readonly (Three.Object3D | undefined)[]): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  for (const object of objects) {
    if (!object || typeof object.userData.index !== "number") continue;
    const box = localFurnitureBox(three, object);
    if (box.isEmpty()) continue;
    const local = ray.clone().applyMatrix4(object.matrixWorld.clone().invert());
    const point = local.intersectBox(box, new three.Vector3());
    if (!point) continue;
    const distance = point.applyMatrix4(object.matrixWorld).distanceTo(ray.origin);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = object.userData.index;
    }
  }
  return best;
}
