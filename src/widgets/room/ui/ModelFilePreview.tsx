"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type * as Three from "three";
import { cn } from "@/shared/lib";

export interface ModelDimensions {
  width: number;
  depth: number;
  height: number;
}

export interface ExportedModel extends ModelDimensions {
  glb: Blob;
  thumbnail: Blob;
}

/** 미리보기에서 맞춘 모양을 그대로 GLB·썸네일로 내보낸다. */
export type ExportModel = () => Promise<ExportedModel>;

/** 서버가 받는 GLB 최대 크기(BE CustomFurnitureService.MAX_MODEL_BYTES). */
export const MAX_MODEL_BYTES = 30 * 1024 * 1024;
const THUMBNAIL_SIDE = 256;

/**
 * 올린 GLB를 3D로 보여 주고, 사용자가 고른 대로 세우고(x축 90°씩)·앞을 돌리고(y축 90°씩)·높이에 맞춘다.
 * 바닥 가운데가 원점, 앞(바닥의 화살표)이 +z, 단위 m — 3D 방에 그대로 놓이는 모양.
 * `exportRef.current()`로 그 모양을 GLB(텍스처 최대 1024px)와 썸네일 PNG로 내보낸다.
 */
export function ModelFilePreview({
  file,
  uprightTurns,
  yawTurns,
  height,
  onDimensions,
  onError,
  exportRef,
  className,
}: {
  file: File;
  /** x축으로 90°씩 — 누워 있는 모델(z가 위인 파일 등)을 세운다. */
  uprightTurns: number;
  /** y축으로 90°씩 — 앞이 화살표 쪽을 보게. */
  yawTurns: number;
  /** 실제 높이(m). */
  height: number;
  onDimensions: (dimensions: ModelDimensions) => void;
  onError: (message: string) => void;
  exportRef: RefObject<ExportModel | null>;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<PreviewView | null>(null);
  const [loading, setLoading] = useState(true);
  const callbacks = useRef({ onDimensions, onError });
  useEffect(() => {
    callbacks.current = { onDimensions, onError };
  });

  // 파일이 바뀌면 무대를 새로 만든다
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let view: PreviewView | null = null;
    setLoading(true);
    createPreview(container, file)
      .then((created) => {
        if (cancelled) {
          created.dispose();
          return;
        }
        view = created;
        viewRef.current = created;
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoading(false);
        callbacks.current.onError(error instanceof Error ? error.message : "3D 파일을 열지 못했어요.");
      });
    return () => {
      cancelled = true;
      view?.dispose();
      viewRef.current = null;
      exportRef.current = null;
    };
  }, [file, exportRef]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || loading) return;
    callbacks.current.onDimensions(view.arrange(uprightTurns, yawTurns, height));
    exportRef.current = () => view.export();
  }, [loading, uprightTurns, yawTurns, height, exportRef]);

  return (
    <div className={cn("relative overflow-hidden border border-line bg-wash", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {loading && <p className="absolute inset-0 flex items-center justify-center text-sm text-soft">3D 파일을 여는 중…</p>}
    </div>
  );
}

interface PreviewView {
  arrange(uprightTurns: number, yawTurns: number, height: number): ModelDimensions;
  export(): Promise<ExportedModel>;
  dispose(): void;
}

async function createPreview(container: HTMLElement, file: File): Promise<PreviewView> {
  const [three, { GLTFLoader }, { GLTFExporter }, { OrbitControls }, { MeshoptDecoder }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/exporters/GLTFExporter.js"),
    import("three/examples/jsm/controls/OrbitControls.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
  ]);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  let model: Three.Object3D;
  try {
    model = (await loader.parseAsync(await file.arrayBuffer(), "")).scene;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    throw new Error(/draco/i.test(message)
      ? "Draco로 압축된 GLB는 아직 읽지 못해요. 압축하지 않은 GLB로 내보내 주세요."
      : "GLB 파일을 열지 못했어요. glTF 2.0 바이너리(.glb)인지 확인해 주세요.");
  }

  const renderer = new three.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  const scene = new three.Scene();
  scene.add(new three.HemisphereLight(0xffffff, 0x8d8a84, 2.2));
  const sun = new three.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 4, 3);
  scene.add(sun);

  // 맞춘 모양: pivot(높이 맞춤·바닥 가운데) ← yaw(앞 돌리기) ← upright(세우기) ← 모델
  const upright = new three.Group();
  upright.add(model);
  const yaw = new three.Group();
  yaw.add(upright);
  const pivot = new three.Group();
  pivot.name = "furniture";
  pivot.add(yaw);
  scene.add(pivot);

  const helpers = new three.Group();
  scene.add(helpers);
  const camera = new three.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  let frame = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  let dims: ModelDimensions = { width: 1, depth: 1, height: 1 };

  function rebuildHelpers() {
    helpers.clear();
    const span = Math.max(dims.width, dims.depth, 0.5) * 1.6;
    helpers.add(new three.GridHelper(span, 10, 0xb9b6ae, 0xdedbd4));
    // 앞(+z) 화살표 — 이쪽이 3D 방에서 가구의 앞
    const arrow = new three.ArrowHelper(new three.Vector3(0, 0, 1), new three.Vector3(0, 0.002, dims.depth / 2 + 0.05), span * 0.22, 0xd7a12a, span * 0.08, span * 0.05);
    helpers.add(arrow);
  }

  function frameCamera() {
    const radius = Math.max(dims.width, dims.depth, dims.height) * 1.1;
    camera.position.set(radius * 1.2, dims.height * 0.75 + radius * 0.6, radius * 1.9);
    controls.target.set(0, dims.height / 2, 0);
    controls.update();
  }

  return {
    arrange(uprightTurns, yawTurns, height) {
      upright.rotation.set((uprightTurns * Math.PI) / 2, 0, 0);
      yaw.rotation.set(0, (yawTurns * Math.PI) / 2, 0);
      pivot.position.set(0, 0, 0);
      pivot.scale.setScalar(1);
      pivot.updateMatrixWorld(true);
      const box = new three.Box3().setFromObject(yaw);
      const size = box.getSize(new three.Vector3());
      if (size.y <= 0) throw new Error("모양이 비어 있는 3D 파일이에요.");
      const scale = Math.max(height, 0.01) / size.y;
      pivot.scale.setScalar(scale);
      pivot.position.set(-((box.min.x + box.max.x) / 2) * scale, -box.min.y * scale, -((box.min.z + box.max.z) / 2) * scale);
      dims = { width: size.x * scale, depth: size.z * scale, height: size.y * scale };
      rebuildHelpers();
      frameCamera();
      return dims;
    },
    async export() {
      // 썸네일: 도우미를 숨기고 3/4 각도에서 투명 배경으로 한 장
      helpers.visible = false;
      const saved = { position: camera.position.clone(), target: controls.target.clone() };
      frameCamera();
      renderer.render(scene, camera);
      const thumbnail = await canvasThumbnail(renderer.domElement);
      camera.position.copy(saved.position);
      controls.target.copy(saved.target);
      helpers.visible = true;

      const exported = await new GLTFExporter().parseAsync(pivot, { binary: true, maxTextureSize: 1024 });
      const glb = new Blob([exported as ArrayBuffer], { type: "model/gltf-binary" });
      if (glb.size > MAX_MODEL_BYTES) throw new Error("맞춘 3D 파일이 30MB를 넘어요. 더 가벼운 파일로 올려 주세요.");
      return { glb, thumbnail, ...dims };
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as Three.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
        materials.forEach((material) => material.dispose());
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/** 캔버스 가운데를 정사각형으로 잘라 256px PNG로. */
function canvasThumbnail(source: HTMLCanvasElement): Promise<Blob> {
  const side = Math.min(source.width, source.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = THUMBNAIL_SIDE;
  canvas.getContext("2d")!.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, THUMBNAIL_SIDE, THUMBNAIL_SIDE);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("썸네일을 만들지 못했어요."))), "image/png"));
}
