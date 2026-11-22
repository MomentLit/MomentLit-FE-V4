import type * as Three from "three";
import { apiClient } from "@/shared/api";
import type { FurnitureDef } from "./furniture";
import { furnitureModelKey } from "./furniture";
import { fetchPolyHavenGltf, polyHavenUrlModifier } from "./polyHaven";

/**
 * 모델 가구를 받아 둔다 — 같은 모델은 한 번만 받고, 놓을 때마다 `clone()`해서 기하·재질을 나눠 쓴다.
 * 나눠 쓰는 메시는 `userData.sharedModel`이 true라 무대가 가구를 지울 때 dispose하지 않는다.
 *
 * - 내 가구 GLB(`model`): 소유자 API에서 받아 실제 크기 그대로 쓴다.
 * - Poly Haven glTF(`polyHavenId`): 받은 뒤 바닥 가운데로 옮기고, 원본 단위가 틀렸으면 실제 높이에 맞춘다.
 */
const cache = new Map<string, Promise<Three.Object3D>>();

async function loaders() {
  const [three, { GLTFLoader }, { MeshoptDecoder }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]);
  return { three, GLTFLoader, MeshoptDecoder };
}

function markShared(root: Three.Object3D) {
  root.traverse((child) => {
    const mesh = child as Three.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.sharedModel = true;
  });
}

/** 바닥(y=0) 가운데가 원점이 되게 감싸고, 높이가 실제와 20% 넘게 다르면 크기를 맞춘다. */
function normalize(three: typeof Three, scene: Three.Object3D, expectedHeight: number | undefined): Three.Object3D {
  scene.updateMatrixWorld(true);
  const box = new three.Box3().setFromObject(scene);
  const size = box.getSize(new three.Vector3());
  const ratio = expectedHeight && size.y > 0 ? expectedHeight / size.y : 1;
  const scale = ratio > 1.2 || ratio < 1 / 1.2 ? ratio : 1;
  const pivot = new three.Group();
  pivot.add(scene);
  pivot.scale.setScalar(scale);
  pivot.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
  const root = new three.Group();
  root.add(pivot);
  return root;
}

async function load(def: FurnitureDef): Promise<Three.Object3D> {
  const { three, GLTFLoader, MeshoptDecoder } = await loaders();
  if (def.model) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    if (def.custom) {
      const { data } = await apiClient.get<ArrayBuffer>(def.model, { responseType: "arraybuffer" });
      return (await loader.parseAsync(data, "")).scene;
    }
    return (await loader.loadAsync(def.model)).scene;
  }
  if (!def.polyHavenId) throw new Error(`${def.id}: 모델이 없어요.`);
  const gltf = await fetchPolyHavenGltf(def.polyHavenId);
  const manager = new three.LoadingManager();
  manager.setURLModifier(polyHavenUrlModifier(gltf));
  const loaded = await new GLTFLoader(manager).loadAsync(gltf.url);
  return normalize(three, loaded.scene, def.height);
}

export function loadFurnitureModel(def: FurnitureDef): Promise<Three.Object3D> {
  const key = furnitureModelKey(def);
  if (!key) return Promise.reject(new Error(`${def.id}: 모델 가구가 아니에요.`));
  let pending = cache.get(key);
  if (!pending) {
    pending = load(def).then((model) => {
      markShared(model);
      return model;
    });
    // 실패하면 다음에 다시 받아 볼 수 있게 지운다.
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending.then((template) => template.clone());
}
