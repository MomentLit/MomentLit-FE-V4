import type * as Three from "three";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import { findFurniture, furnitureModelKey, furnitureMount, isStackable, type FurnitureDef } from "./furniture";
import { loadFurnitureModel } from "./furnitureModels";
import { localFurnitureBox, nearestFurnitureBox } from "./furniturePick";
import { ceilingMountY, DEFAULT_WALL_CENTER, nearestWallPlacement, wallMountedAt, wallMountY } from "./placement";
import {
  centroid,
  directionToUv,
  floorPointFromUv,
  pointInPolygon,
  signedArea,
  wallLengths,
  type Vec2,
  type Vec3,
} from "./geometry";
import { eyeHeight, RUN_SPEED, startPosition, step, WALK_SPEED, canStand, type WalkArea } from "./walk";

/**
 * 파노라마 방 3D 무대 — 렌더러·카메라·포인터를 React 밖에서 관리한다(프로토타입 panorama-room.html 이식).
 *
 * 좌표: 사진을 찍은 눈 위치가 원점, 바닥은 y = -촬영 높이, 천장은 y = 천장 - 촬영 높이.
 * 벽·바닥·천장은 셰이더로 "그 점을 카메라에서 본 방향의 사진 픽셀"을 칠한다 — 사진 시점에서는 사진과 똑같이 보이고,
 * 미니어처·1인칭에서는 사진이 벽에 붙은 모형이 된다.
 */

type ThreeModule = typeof Three;
type OrbitControlsClass = new (camera: Three.Camera, element: HTMLElement) => OrbitControlsType;

export type RoomView = "photo" | "miniature" | "walk";

/** 끌고 있는 가구 — 위에 올려 둔 소품(children)은 같은 만큼 따라 움직인다. */
interface FurnitureDrag {
  index: number;
  /** 누른 점과 가구 중심의 차이(바닥에 놓인 가구만). */
  offset: Vec2;
  children: { index: number; dx: number; dz: number; dy: number }[];
  /** 놓을 자리를 찾을 때 무시할 가구(자신과 위의 소품). */
  ignore: Set<number>;
}
/** 사진 시점에서 누르기의 의미 — 바닥 모서리 찍기 / 천장 모서리 찍기(높이 재기) / 없음. */
export type PickMode = "corners" | "ceiling" | "none";

export interface StageFurniture {
  type: string;
  x: number;
  z: number;
  rotation: number;
  /** 바닥에서 밑면까지 높이(m). 없으면 바닥. */
  y?: number | null;
}

/** 가구를 놓을 자리 — 벽 가구는 벽을 보게 하는 회전도 준다. */
export interface FurniturePlacement {
  x: number;
  z: number;
  y: number;
  rotation?: number;
}

export interface FurnitureMove extends FurniturePlacement {
  index: number;
}

/** 도면 방 바닥에 깔 도면 이미지 자리(m) — planModel의 PlanFloorImage와 같은 모양. */
export interface StageFloorImage {
  url: string;
  x: number;
  z: number;
  width: number;
  height: number;
}

/**
 * 벽·바닥을 무엇으로 칠할지 — 파노라마 방은 사진을 투영하고, 도면 방은 흰 벽·흰 천장에 바닥만 도면(또는 나무색)으로.
 * 도면 방에는 사진 시점이 없다.
 */
export type StageSurface = { kind: "panorama" } | { kind: "plan"; floor: StageFloorImage | null };

export interface RoomStageState {
  /** 기본은 파노라마. */
  surface?: StageSurface;
  /** 1인칭 시작 자리 — 없으면 원점(파노라마 방은 사진 찍은 자리), null이면 방 무게중심. */
  walkStart?: Vec2 | null;
  /** 바닥 다각형(m). */
  outer: readonly Vec2[];
  /** 편집할 바닥 모서리의 사진 좌표 — 방 만들기 화면만. `outer`와 순서가 같다. */
  corners: readonly Vec2[];
  inner: readonly (readonly [Vec2, Vec2])[];
  cameraHeight: number;
  ceilingHeight: number;
}

export interface RoomStageCallbacks {
  onCornersChange?: (corners: Vec2[]) => void;
  onCeilingPick?: (uv: Vec2) => void;
  onHint?: (message: string) => void;
  onFurnitureSelect?: (index: number | null) => void;
  /** 끌어서 옮긴 가구들 — 위에 올린 소품도 같이 오고, 받침이 사라진 소품은 내려앉는다. */
  onFurnitureMove?: (moves: FurnitureMove[]) => void;
  /** 끌기를 마쳤을 때 — 실행 취소 기록 등에 쓴다. */
  onFurnitureDragEnd?: () => void;
  onPlace?: (placement: FurniturePlacement) => void;
  /** 받고 있는 가구 모델 수가 바뀔 때 — 0이면 다 받았다. */
  onFurnitureLoading?: (count: number) => void;
}

const TAPE = 0xf2bc2e;
const MARKER_PICK_PX = 22;
const DRAG_THRESHOLD_PX = 5;
const STAGE_BACKGROUND = 0xd9dcd6;
const WALK_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);

const VERTEX_SHADER = `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

// 카메라에서 이 점을 본 방향 → 등장방형 좌표. geometry.ts의 directionToUv와 같은 식.
const FRAGMENT_SHADER = `
uniform sampler2D panorama;
uniform vec3 eye;
varying vec3 vWorld;
void main() {
  vec3 d = normalize(vWorld - eye);
  float lon = atan(-d.x, d.z);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  vec2 uv = vec2(lon / 6.28318531 + 0.5, 0.5 + lat / 3.14159265);
  gl_FragColor = vec4(texture2D(panorama, uv).rgb, 1.0);
}`;

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName));
}

export class RoomStage {
  private readonly three: ThreeModule;
  private readonly container: HTMLElement;
  private readonly callbacks: RoomStageCallbacks;
  private readonly renderer: Three.WebGLRenderer;
  private readonly scene: Three.Scene;
  private readonly photoCamera: Three.PerspectiveCamera;
  private readonly miniatureCamera: Three.PerspectiveCamera;
  private readonly walkCamera: Three.PerspectiveCamera;
  private readonly controls: OrbitControlsType;
  private readonly raycaster: Three.Raycaster;
  private readonly roomMaterial: Three.ShaderMaterial;
  private readonly skyMaterial: Three.ShaderMaterial;
  private readonly sky: Three.Mesh;
  private readonly sun: Three.DirectionalLight;
  private readonly roomGroup: Three.Group;
  private readonly markerGroup: Three.Group;
  private readonly labelGroup: Three.Group;
  private readonly furnitureGroup: Three.Group;
  private readonly furnitureMaterials: Record<string, Three.MeshStandardMaterial>;
  private readonly resizeObserver: ResizeObserver;
  private readonly timer: Three.Timer;
  private ceilingMesh: Three.Mesh | null = null;
  private selectionBox: Three.BoxHelper | null = null;
  private texture: Three.Texture | null = null;
  private readonly planWallMaterial: Three.MeshStandardMaterial;
  private readonly planInnerMaterial: Three.MeshStandardMaterial;
  private readonly planCeilingMaterial: Three.MeshStandardMaterial;
  private readonly planFloorMaterial: Three.MeshStandardMaterial;
  private planFloorTexture: { url: string; texture: Three.Texture } | null = null;
  private frame = 0;
  private disposed = false;
  /** 지금 받고 있는 모델 가구 수 — 0보다 크면 스켈레톤 상자를 깜빡인다. */
  private loadingFurniture = 0;
  private readonly ghostLineMaterial: Three.LineBasicMaterial;

  private state: RoomStageState = { outer: [], corners: [], inner: [], cameraHeight: 1.5, ceilingHeight: 2.4 };
  private view: RoomView = "photo";
  private pickMode: PickMode = "none";
  private furnitureEditable = false;
  private placingType: string | null = null;
  private furniture: StageFurniture[] = [];
  /** `furniture`와 같은 순서의 메시. */
  private furnitureObjects: (Three.Group | undefined)[] = [];
  private selectedFurniture: number | null = null;
  private yaw = 0;
  private pitch = -0.3;
  private miniaturePlaced = false;
  private readonly walk = {
    position: [0, 0] as Vec2,
    yaw: 0,
    pitch: 0,
    keys: new Set<string>(),
    target: null as Vec2 | null,
    needsReset: true,
  };
  private pointer: {
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    walkYaw: number;
    walkPitch: number;
    moved: boolean;
    corner: number;
    drag: FurnitureDrag | null;
  } | null = null;

  constructor(three: ThreeModule, OrbitControls: OrbitControlsClass, container: HTMLElement, callbacks: RoomStageCallbacks = {}) {
    this.three = three;
    this.container = container;
    this.callbacks = callbacks;
    this.timer = new three.Timer();

    this.renderer = new three.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = three.PCFShadowMap;
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new three.Scene();
    this.photoCamera = new three.PerspectiveCamera(75, 1, 0.01, 200);
    this.miniatureCamera = new three.PerspectiveCamera(45, 1, 0.05, 200);
    this.walkCamera = new three.PerspectiveCamera(70, 1, 0.05, 200);
    this.raycaster = new three.Raycaster();
    // 스켈레톤 윤곽선(LineSegments)이 기본 문턱(1m)으로 멀리서도 잡히지 않게
    this.raycaster.params.Line = { threshold: 0.01 };

    const uniforms = { panorama: { value: null as Three.Texture | null }, eye: { value: new three.Vector3() } };
    this.roomMaterial = new three.ShaderMaterial({ uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER });
    // 도면 방 — 사진이 없으니 흰 벽·흰 천장, 바닥은 도면(없으면 나무색)
    this.planWallMaterial = new three.MeshStandardMaterial({ color: 0xe8e6e0, roughness: 0.92 });
    this.planInnerMaterial = new three.MeshStandardMaterial({ color: 0xdcd9d1, roughness: 0.9 });
    this.planCeilingMaterial = new three.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 0.95 });
    this.planFloorMaterial = new three.MeshStandardMaterial({ color: 0xb89b78, roughness: 0.85 });
    this.skyMaterial = new three.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      side: three.BackSide,
      depthWrite: false,
    });
    this.sky = new three.Mesh(new three.SphereGeometry(50, 64, 32), this.skyMaterial);
    this.sky.renderOrder = -1;
    this.sky.visible = false;
    this.scene.add(this.sky);

    // 가구용 조명 — 벽·바닥은 사진을 그대로 칠해서 조명을 받지 않는다.
    this.scene.add(new three.HemisphereLight(0xffffff, 0x8a8778, 1.8));
    this.sun = new three.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);

    this.furnitureMaterials = {
      fabric: new three.MeshStandardMaterial({ color: 0x6f7b88, roughness: 0.92 }),
      cushion: new three.MeshStandardMaterial({ color: 0x7f8b98, roughness: 0.95 }),
      wood: new three.MeshStandardMaterial({ color: 0x9c7350, roughness: 0.7 }),
      white: new three.MeshStandardMaterial({ color: 0xe9e7e1, roughness: 0.6 }),
      dark: new three.MeshStandardMaterial({ color: 0x34393e, roughness: 0.45, metalness: 0.2 }),
      leaf: new three.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.85 }),
      pot: new three.MeshStandardMaterial({ color: 0xc8b9a6, roughness: 0.8 }),
      // 모델 가구를 받는 동안 보이는 반투명 상자
      ghost: new three.MeshStandardMaterial({ color: 0xf4f3ef, roughness: 1, transparent: true, opacity: 0.35, depthWrite: false }),
    };
    this.ghostLineMaterial = new three.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

    this.roomGroup = new three.Group();
    this.markerGroup = new three.Group();
    this.labelGroup = new three.Group();
    this.furnitureGroup = new three.Group();
    this.scene.add(this.roomGroup, this.markerGroup, this.labelGroup, this.furnitureGroup);

    this.controls = new OrbitControls(this.miniatureCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.enabled = false;

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    canvas.addEventListener("pointermove", this.handlePointerMove);
    canvas.addEventListener("pointerup", this.handlePointerUp);
    canvas.addEventListener("pointercancel", this.handlePointerCancel);
    canvas.addEventListener("wheel", this.handleWheel, { passive: false });
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.applyView();
    this.tick();
  }

  /** 사진을 불러온다. S3 사진이라 CORS(crossOrigin)로 받아야 WebGL 텍스처로 쓸 수 있다. */
  async setImage(url: string): Promise<void> {
    const loader = new this.three.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const texture = await loader.loadAsync(url);
    if (this.disposed) {
      texture.dispose();
      return;
    }
    texture.minFilter = this.three.LinearFilter;
    texture.magFilter = this.three.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = this.three.RepeatWrapping;
    this.texture?.dispose();
    this.texture = texture;
    this.roomMaterial.uniforms.panorama.value = texture;
    this.applyView();
  }

  setState(state: RoomStageState) {
    this.state = state;
    this.rebuild();
  }

  setView(view: RoomView) {
    if (view !== "photo" && this.state.outer.length < 3) return;
    // 도면 방엔 사진이 없다 — 사진 시점 대신 미니어처
    if (view === "photo" && this.isPlan()) view = "miniature";
    const previous = this.view;
    this.view = view;
    if (view === "walk" && (this.walk.needsReset || previous !== "walk")) this.resetWalk();
    this.walk.keys.clear();
    this.walk.target = null;
    this.applyView();
  }

  setPickMode(mode: PickMode) {
    this.pickMode = mode;
  }

  /** 가구를 고르고 끌고 놓을 수 있게 할지. */
  setFurnitureEditable(editable: boolean) {
    this.furnitureEditable = editable;
  }

  /** 다음 바닥 클릭에 놓을 가구 종류(null이면 놓기 안 함). */
  setPlacing(type: string | null) {
    this.placingType = type;
  }

  /** 가구 목록을 화면에 맞춘다. 같은 자리의 같은 종류는 메시를 다시 만들지 않고 위치·회전만 바꾼다(끌기 중 매 프레임 호출됨). */
  setFurniture(items: readonly StageFurniture[], selected: number | null) {
    const floorY = -this.state.cameraHeight;
    items.forEach((item, index) => {
      let object = this.furnitureObjects[index];
      // 모델 가구는 카탈로그를 늦게 받으면 상자로 먼저 만들어지므로, 모델 주소가 생기면 다시 만든다.
      const model = furnitureModelKey(findFurniture(item.type));
      if (object && (object.userData.type !== item.type || object.userData.model !== model)) {
        this.disposeObject(object);
        this.furnitureGroup.remove(object);
        object = undefined;
      }
      if (!object) {
        object = this.buildFurniture(item.type);
        this.furnitureGroup.add(object);
        this.furnitureObjects[index] = object;
      }
      object.userData.index = index;
      object.position.set(item.x, floorY + (item.y ?? 0), item.z);
      object.rotation.y = item.rotation;
    });
    for (const extra of this.furnitureObjects.splice(items.length)) {
      if (!extra) continue;
      this.disposeObject(extra);
      this.furnitureGroup.remove(extra);
    }
    this.furniture = items.map((item) => ({ ...item }));
    this.selectedFurniture = selected;
    this.updateSelectionBox();
    this.scheduleSettle();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.handlePointerDown);
    canvas.removeEventListener("pointermove", this.handlePointerMove);
    canvas.removeEventListener("pointerup", this.handlePointerUp);
    canvas.removeEventListener("pointercancel", this.handlePointerCancel);
    canvas.removeEventListener("wheel", this.handleWheel);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    this.controls.dispose();
    this.clearGroup(this.roomGroup);
    this.clearGroup(this.markerGroup);
    this.clearGroup(this.labelGroup);
    this.clearGroup(this.furnitureGroup);
    this.furnitureObjects = [];
    this.removeSelectionBox();
    Object.values(this.furnitureMaterials).forEach((material) => material.dispose());
    this.ghostLineMaterial.dispose();
    this.sky.geometry.dispose();
    this.roomMaterial.dispose();
    this.skyMaterial.dispose();
    this.texture?.dispose();
    this.planFloorTexture?.texture.dispose();
    for (const material of [this.planWallMaterial, this.planInnerMaterial, this.planCeilingMaterial, this.planFloorMaterial]) material.dispose();
    this.timer.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---------- 방 만들기 ----------

  private walkArea(): WalkArea {
    return { outer: this.state.outer, inner: this.state.inner };
  }

  private rebuild() {
    const three = this.three;
    const { outer: points, cameraHeight, ceilingHeight } = this.state;
    const floorY = -cameraHeight;
    const ceilingY = ceilingHeight - cameraHeight;

    this.clearGroup(this.markerGroup);
    this.clearGroup(this.roomGroup);
    this.clearGroup(this.labelGroup);
    this.ceilingMesh = null;
    this.furnitureObjects.forEach((object, index) => {
      if (object) object.position.y = floorY + (this.furniture[index]?.y ?? 0);
    });

    // 편집할 모서리 표시(사진 시점)
    if (this.state.corners.length > 0) {
      const sphere = new three.SphereGeometry(0.045, 16, 12);
      const markerMaterial = new three.MeshBasicMaterial({ color: TAPE, depthTest: false });
      points.forEach(([x, z], i) => {
        const marker = new three.Mesh(sphere, markerMaterial);
        marker.position.set(x, floorY, z);
        marker.renderOrder = 5;
        this.markerGroup.add(marker);
        const label = this.makeLabel(String(i + 1), false);
        label.position.set(x, floorY + 0.16, z);
        this.markerGroup.add(label);
      });
      if (points.length > 1) {
        const line = points.map(([x, z]) => new three.Vector3(x, floorY, z));
        if (points.length > 2) line.push(line[0].clone());
        const outline = new three.Line(
          new three.BufferGeometry().setFromPoints(line),
          new three.LineBasicMaterial({ color: TAPE, depthTest: false, transparent: true }),
        );
        outline.renderOrder = 4;
        this.markerGroup.add(outline);
      }
    }

    if (points.length < 3 || ceilingY <= 0.05) {
      if (this.view !== "photo") {
        this.view = "photo";
        this.applyView();
      }
      return;
    }

    // 바닥(ShapeGeometry는 xy 평면 → x축으로 눕힌다)
    const floorGeometry = new three.ShapeGeometry(new three.Shape(points.map(([x, z]) => new three.Vector2(x, -z))));
    floorGeometry.rotateX(-Math.PI / 2);
    floorGeometry.translate(0, floorY, 0);
    const plan = this.isPlan();
    if (plan) this.preparePlanFloor();
    const floorMesh = new three.Mesh(floorGeometry, plan ? this.planFloorMaterial : this.roomMaterial);
    floorMesh.receiveShadow = plan;
    this.roomGroup.add(floorMesh);
    // 가구 그림자만 받는 투명 바닥
    const shadow = new three.Mesh(floorGeometry.clone(), new three.ShadowMaterial({ opacity: 0.3 }));
    shadow.position.y = 0.003;
    shadow.receiveShadow = true;
    this.roomGroup.add(shadow);

    const ceilingGeometry = new three.ShapeGeometry(new three.Shape(points.map(([x, z]) => new three.Vector2(x, z))));
    ceilingGeometry.rotateX(Math.PI / 2);
    ceilingGeometry.translate(0, ceilingY, 0);
    this.ceilingMesh = new three.Mesh(ceilingGeometry, plan ? this.planCeilingMaterial : this.roomMaterial);
    this.roomGroup.add(this.ceilingMesh);

    // 벽: 안쪽에서만 보이게 감는 방향을 맞춘다 → 미니어처에서 카메라 쪽 벽은 뒷면이라 안 보여 방 안이 들여다보인다.
    const ccw = signedArea(points) > 0;
    const lengths = wallLengths(points);
    points.forEach((a, i) => {
      const b = points[(i + 1) % points.length];
      const geometry = new three.BufferGeometry();
      geometry.setAttribute("position", new three.Float32BufferAttribute([
        a[0], floorY, a[1], b[0], floorY, b[1], b[0], ceilingY, b[1], a[0], ceilingY, a[1],
      ], 3));
      geometry.setIndex(ccw ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
      const wallMesh = new three.Mesh(geometry, plan ? this.planWallMaterial : this.roomMaterial);
      wallMesh.receiveShadow = plan;
      this.roomGroup.add(wallMesh);

      const label = this.makeLabel(`${lengths[i].toFixed(2)}m`, true);
      label.position.set((a[0] + b[0]) / 2, floorY + 0.08, (a[1] + b[1]) / 2);
      this.labelGroup.add(label);
    });

    // 안쪽 벽: 두께 10cm 상자
    const innerMaterial = this.planInnerMaterial;
    for (const [a, b] of this.state.inner) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length < 0.05) continue;
      const wall = new three.Mesh(new three.BoxGeometry(length + 0.1, ceilingY - floorY, 0.1), innerMaterial);
      wall.position.set((a[0] + b[0]) / 2, (floorY + ceilingY) / 2, (a[1] + b[1]) / 2);
      wall.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      wall.castShadow = wall.receiveShadow = true;
      this.roomGroup.add(wall);
    }

    const [cx, cz] = centroid(points);
    this.sun.position.set(cx + 1.5, floorY + 6, cz + 2);
    this.sun.target.position.set(cx, floorY, cz);
    if (!this.miniaturePlaced) {
      const span = Math.max(...points.map(([x, z]) => Math.hypot(x - cx, z - cz)));
      this.miniatureCamera.position.set(cx + span * 0.4, floorY + span * 1.6 + 2.5, cz + span * 1.5 + 1.5);
      this.controls.target.set(cx, floorY + 0.4, cz);
      this.controls.update();
      this.miniaturePlaced = true;
    }
    if (!canStand(this.walk.position, this.walkArea())) this.walk.needsReset = true;
    this.applyView();
  }

  private isPlan() {
    return this.state.surface?.kind === "plan";
  }

  /**
   * 도면 방 바닥에 도면 이미지를 깐다. 바닥 ShapeGeometry의 uv는 (x, -z)라서, repeat·offset으로
   * 이미지 왼쪽 위(x, z)가 uv (0, 1), 오른쪽 아래가 (1, 0)이 되게 맞춘다. 이미지는 한 번만 받고 바뀔 때만 다시 받는다.
   */
  private preparePlanFloor() {
    const surface = this.state.surface;
    const floor = surface?.kind === "plan" ? surface.floor : null;
    const material = this.planFloorMaterial;
    if (!floor) {
      material.map = null;
      material.color.set(0xb89b78);
      material.needsUpdate = true;
      return;
    }
    const apply = (texture: Three.Texture) => {
      texture.repeat.set(1 / floor.width, 1 / floor.height);
      texture.offset.set(-floor.x / floor.width, 1 + floor.z / floor.height);
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
    };
    if (this.planFloorTexture?.url === floor.url) {
      apply(this.planFloorTexture.texture);
      return;
    }
    const loader = new this.three.TextureLoader();
    loader.setCrossOrigin("anonymous");
    const url = floor.url;
    loader.loadAsync(url).then((texture) => {
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = this.three.SRGBColorSpace;
      texture.wrapS = texture.wrapT = this.three.ClampToEdgeWrapping;
      this.planFloorTexture?.texture.dispose();
      this.planFloorTexture = { url, texture };
      // 받는 사이에 도면이 또 바뀌었으면 지금 것으로 다시 맞춘다
      this.preparePlanFloor();
    }).catch(() => {
      this.callbacks.onHint?.("도면 이미지를 불러오지 못했어요.");
    });
  }

  private makeLabel(text: string, dark: boolean): Three.Sprite {
    const three = this.three;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const font = '600 40px Pretendard, "Apple SD Gothic Neo", sans-serif';
    context.font = font;
    const width = Math.ceil(context.measureText(text).width) + 32;
    canvas.width = width;
    canvas.height = 64;
    context.font = font;
    context.fillStyle = dark ? "#1d2226" : "#f2bc2e";
    context.beginPath();
    context.roundRect(0, 0, width, 64, 14);
    context.fill();
    context.fillStyle = dark ? "#f2bc2e" : "#1d2226";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, width / 2, 34);
    const texture = new three.CanvasTexture(canvas);
    texture.minFilter = three.LinearFilter;
    const sprite = new three.Sprite(new three.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    sprite.scale.set(width * 0.0032, 64 * 0.0032, 1);
    sprite.renderOrder = 10;
    return sprite;
  }

  // ---------- 가구 모양(실제 크기, m) ----------

  private box(group: Three.Group, w: number, h: number, d: number, x: number, y: number, z: number, material: Three.Material) {
    const mesh = new this.three.Mesh(new this.three.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }

  private legs(group: Three.Group, w: number, d: number, h: number, s: number) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) this.box(group, s, h, s, sx * (w / 2 - s), 0, sz * (d / 2 - s), this.furnitureMaterials.wood);
    }
  }

  private buildFurniture(type: string): Three.Group {
    const three = this.three;
    const m = this.furnitureMaterials;
    const g = new three.Group();
    g.userData.type = type;
    const def = findFurniture(type);
    g.userData.model = furnitureModelKey(def);
    if (def && g.userData.model) {
      this.buildModelFurniture(g, def);
      return g;
    }
    const b = this.box.bind(this, g);
    switch (type) {
      case "sofa-3":
        b(2.1, 0.42, 0.9, 0, 0, 0, m.fabric); b(2.1, 0.5, 0.2, 0, 0.42, -0.35, m.fabric);
        b(0.18, 0.64, 0.9, -0.96, 0, 0, m.fabric); b(0.18, 0.64, 0.9, 0.96, 0, 0, m.fabric);
        b(0.86, 0.12, 0.66, -0.44, 0.42, 0.08, m.cushion); b(0.86, 0.12, 0.66, 0.44, 0.42, 0.08, m.cushion);
        break;
      case "bed-queen":
        b(1.6, 0.3, 2.1, 0, 0, 0, m.wood); b(1.52, 0.22, 2.0, 0, 0.3, 0.03, m.white);
        b(1.6, 1.0, 0.08, 0, 0, -1.01, m.wood); b(0.6, 0.12, 0.4, -0.38, 0.52, -0.72, m.white); b(0.6, 0.12, 0.4, 0.38, 0.52, -0.72, m.white);
        break;
      case "desk":
        b(1.2, 0.04, 0.6, 0, 0.71, 0, m.wood); this.legs(g, 1.2, 0.6, 0.71, 0.05);
        break;
      case "chair":
        b(0.45, 0.05, 0.45, 0, 0.43, 0, m.wood); this.legs(g, 0.45, 0.45, 0.43, 0.04); b(0.45, 0.45, 0.04, 0, 0.48, -0.205, m.wood);
        break;
      case "table-4":
        b(1.4, 0.04, 0.8, 0, 0.71, 0, m.white); this.legs(g, 1.4, 0.8, 0.71, 0.06);
        break;
      case "wardrobe":
        b(1.2, 2.0, 0.6, 0, 0, 0, m.white); b(0.01, 1.9, 0.01, 0, 0.05, 0.302, m.dark);
        b(0.02, 0.25, 0.03, -0.05, 0.9, 0.31, m.dark); b(0.02, 0.25, 0.03, 0.05, 0.9, 0.31, m.dark);
        break;
      case "tv-stand":
        b(1.8, 0.45, 0.4, 0, 0, 0, m.wood); b(0.3, 0.03, 0.18, 0, 0.45, 0, m.dark); b(1.23, 0.71, 0.04, 0, 0.5, 0, m.dark);
        break;
      case "plant": {
        const pot = new three.Mesh(new three.CylinderGeometry(0.2, 0.15, 0.4, 24), m.pot);
        pot.position.y = 0.2;
        pot.castShadow = true;
        g.add(pot);
        const leaf = new three.Mesh(new three.SphereGeometry(0.32, 24, 16), m.leaf);
        leaf.position.y = 0.75;
        leaf.scale.y = 1.3;
        leaf.castShadow = true;
        g.add(leaf);
        break;
      }
      default:
        // 모르는 종류(받기 전인 모델 가구 포함) — 목록 크기가 있으면 그 크기의 상자
        b(def?.width ?? 0.5, 0.5, def?.depth ?? 0.5, 0, 0, 0, m.white);
    }
    return g;
  }

  /**
   * 스켈레톤 상자(실제 크기, 깜빡이는 반투명 면 + 흰 윤곽선, 그림자 없음)를 먼저 두고, 모델을 받으면 바꾼다.
   * 받지 못하면 흰 상자로 남는다.
   */
  private buildModelFurniture(group: Three.Group, def: FurnitureDef) {
    const three = this.three;
    const height = def.height ?? 0.5;
    const geometry = new three.BoxGeometry(def.width, height, def.depth);
    const face = new three.Mesh(geometry, this.furnitureMaterials.ghost);
    face.position.y = height / 2;
    const outline = new three.LineSegments(new three.EdgesGeometry(geometry), this.ghostLineMaterial);
    outline.position.y = height / 2;
    group.add(face, outline);
    this.setFurnitureLoading(+1);
    loadFurnitureModel(def)
      .finally(() => this.setFurnitureLoading(-1))
      .then((model) => {
        // 받는 사이에 지워졌거나(무대 닫힘·가구 지움) 다른 가구로 바뀌었으면 버린다.
        if (this.disposed || group.parent !== this.furnitureGroup) return;
        this.disposeObject(group);
        group.clear();
        group.add(model);
        delete group.userData.localBox;
        if (this.selectedFurniture !== null && this.furnitureObjects[this.selectedFurniture] === group) this.updateSelectionBox();
      })
      .catch(() => {
        if (this.disposed) return;
        group.children.forEach((child) => {
          const mesh = child as Three.Mesh;
          if (mesh.isMesh) {
            mesh.material = this.furnitureMaterials.white;
            mesh.castShadow = mesh.receiveShadow = true;
          } else {
            child.visible = false;
          }
        });
      });
  }

  private setFurnitureLoading(delta: number) {
    if (this.disposed) return;
    this.loadingFurniture = Math.max(0, this.loadingFurniture + delta);
    this.callbacks.onFurnitureLoading?.(this.loadingFurniture);
    // 모델이 다 오면 받침 높이가 실제 모델 기준으로 바뀌므로 다시 내려앉힌다
    if (this.loadingFurniture === 0) this.scheduleSettle();
  }

  private updateSelectionBox() {
    const target = this.selectedFurniture !== null ? this.furnitureObjects[this.selectedFurniture] : undefined;
    if (!target) {
      this.removeSelectionBox();
      return;
    }
    if (!this.selectionBox) {
      this.selectionBox = new this.three.BoxHelper(target, TAPE);
      (this.selectionBox.material as Three.Material).depthTest = false;
      this.selectionBox.renderOrder = 6;
      this.scene.add(this.selectionBox);
    }
    this.selectionBox.setFromObject(target);
  }

  private removeSelectionBox() {
    if (!this.selectionBox) return;
    this.scene.remove(this.selectionBox);
    this.selectionBox.geometry.dispose();
    (this.selectionBox.material as Three.Material).dispose();
    this.selectionBox = null;
  }

  private disposeObject(object: Three.Object3D) {
    object.traverse((child) => {
      const mesh = child as Three.Mesh;
      // 모델 가구의 기하·재질은 같은 모델끼리 나눠 쓴다(furnitureModels 캐시) — 지우지 않는다.
      if (mesh.userData.sharedModel) return;
      mesh.geometry?.dispose();
      const material = mesh.material as Three.Material | Three.Material[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        // 공유 재질(사진 셰이더, 가구 재질)은 무대를 닫을 때 한 번에 정리한다.
        if (m === this.roomMaterial || this.isSharedMaterial(m)) continue;
        (m as Three.SpriteMaterial).map?.dispose();
        m.dispose();
      }
    });
  }

  private isSharedMaterial(material: Three.Material) {
    return Object.values(this.furnitureMaterials).includes(material as Three.MeshStandardMaterial)
      || material === this.ghostLineMaterial
      || material === this.planWallMaterial
      || material === this.planInnerMaterial
      || material === this.planCeilingMaterial
      || material === this.planFloorMaterial;
  }

  private clearGroup(group: Three.Group) {
    this.disposeObject(group);
    group.clear();
  }

  private applyView() {
    const view = this.view;
    this.sky.visible = view === "photo" && !!this.texture;
    if (this.ceilingMesh) this.ceilingMesh.visible = view !== "miniature";
    this.markerGroup.visible = view === "photo";
    this.labelGroup.visible = view === "miniature";
    this.controls.enabled = view === "miniature";
    this.scene.background = view === "photo" ? null : new this.three.Color(STAGE_BACKGROUND);
    this.renderer.domElement.style.cursor = view === "walk" ? "crosshair" : "";
  }

  // ---------- 1인칭 ----------

  private resetWalk() {
    // 파노라마 방은 사진을 찍은 자리(원점), 도면 방은 무게중심에서 시작한다.
    const preferred = this.state.walkStart === undefined ? [0, 0] as Vec2 : this.state.walkStart;
    const start = startPosition(this.walkArea(), preferred);
    if (start) this.walk.position = start;
    this.walk.yaw = 0;
    this.walk.pitch = 0;
    this.walk.target = null;
    this.walk.needsReset = false;
  }

  private updateWalk(dt: number) {
    const walk = this.walk;
    const keys = walk.keys;
    const fx = -Math.sin(walk.yaw);
    const fz = Math.cos(walk.yaw);
    let mx = 0;
    let mz = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) { mx += fx; mz += fz; }
    if (keys.has("KeyS") || keys.has("ArrowDown")) { mx -= fx; mz -= fz; }
    if (keys.has("KeyD") || keys.has("ArrowRight")) { mx -= fz; mz += fx; }
    if (keys.has("KeyA") || keys.has("ArrowLeft")) { mx += fz; mz -= fx; }
    const distance = (keys.has("ShiftLeft") || keys.has("ShiftRight") ? RUN_SPEED : WALK_SPEED) * dt;
    const area = this.walkArea();

    if (mx || mz) {
      walk.target = null;
      const length = Math.hypot(mx, mz);
      walk.position = step(walk.position, (mx / length) * distance, (mz / length) * distance, area) ?? walk.position;
    } else if (walk.target) {
      const dx = walk.target[0] - walk.position[0];
      const dz = walk.target[1] - walk.position[1];
      const d = Math.hypot(dx, dz);
      const next = d < 0.05 ? null : step(walk.position, (dx / d) * Math.min(d, distance), (dz / d) * Math.min(d, distance), area);
      if (next) walk.position = next;
      else walk.target = null;
    }

    const eye = -this.state.cameraHeight + eyeHeight(this.state.ceilingHeight);
    const cp = Math.cos(walk.pitch);
    const [x, z] = walk.position;
    this.walkCamera.position.set(x, eye, z);
    this.walkCamera.lookAt(x - Math.sin(walk.yaw) * cp, eye + Math.sin(walk.pitch), z + Math.cos(walk.yaw) * cp);
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (this.view !== "walk" || isTypingTarget(event.target) || !WALK_KEYS.has(event.code)) return;
    this.walk.keys.add(event.code);
    event.preventDefault();
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    this.walk.keys.delete(event.code);
  };

  private handleBlur = () => {
    this.walk.keys.clear();
  };

  // ---------- 포인터 ----------

  private activeCamera() {
    if (this.view === "photo") return this.photoCamera;
    return this.view === "walk" ? this.walkCamera : this.miniatureCamera;
  }

  private setRay(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new this.three.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.activeCamera());
  }

  private directionAt(event: PointerEvent): Vec3 {
    this.setRay(event);
    const d = this.raycaster.ray.direction.normalize();
    return [d.x, d.y, d.z];
  }

  private floorHit(event: PointerEvent): Vec2 | null {
    this.setRay(event);
    const plane = new this.three.Plane(new this.three.Vector3(0, 1, 0), this.state.cameraHeight);
    const point = this.raycaster.ray.intersectPlane(plane, new this.three.Vector3());
    return point ? [point.x, point.z] : null;
  }

  // ---------- 가구 놓을 자리 ----------

  /**
   * 누른 곳에 `type` 가구를 놓을 자리. 바닥 가구는 바닥(작으면 가구 윗면·선반 칸), 벽 가구는 누른 벽면(벽이 아니면 가장 가까운 벽),
   * 천장 가구는 천장. 방 밖이면 null. `current`는 끄는 중인 가구(벽 가구 높이를 이어 쓴다).
   */
  private placementAt(event: PointerEvent, type: string, ignore: ReadonlySet<number>, current?: StageFurniture): FurniturePlacement | null {
    const def = findFurniture(type);
    const mount = furnitureMount(def);
    const floorY = -this.state.cameraHeight;
    const ceilingHeight = this.state.ceilingHeight;
    const height = def?.height ?? 0.5;
    const depth = def?.depth ?? 0.1;
    this.setRay(event);
    const ray = this.raycaster.ray;

    if (mount === "wall") {
      const wall = this.wallHit();
      if (wall) {
        const at = wallMountedAt([wall.point.x, wall.point.z], [wall.normal.x, wall.normal.z], depth);
        if (pointInPolygon([at.x, at.z], this.state.outer)) {
          return { ...at, y: wallMountY(wall.point.y - floorY, height, ceilingHeight) };
        }
      }
      const floor = this.planeHit(ray, floorY);
      const snap = floor && nearestWallPlacement(floor, this.state.outer, this.state.inner, depth);
      if (!snap) return null;
      return { x: snap.x, z: snap.z, rotation: snap.rotation, y: current?.y ?? wallMountY(DEFAULT_WALL_CENTER, height, ceilingHeight) };
    }

    if (mount === "ceiling") {
      // 위를 보고 누르면 천장, 아래를 보고 누르면 바닥에서 위치를 잡는다
      const point = ray.direction.y > 0 ? this.planeHit(ray, ceilingHeight + floorY) : this.planeHit(ray, floorY);
      if (!point || !pointInPolygon(point, this.state.outer)) return null;
      return { x: point[0], z: point[1], y: ceilingMountY(height, ceilingHeight) };
    }

    if (isStackable(def)) {
      const surface = this.surfaceHit(ignore);
      if (surface) return surface;
    }
    const floor = this.planeHit(ray, floorY);
    if (!floor || !pointInPolygon(floor, this.state.outer)) return null;
    return { x: floor[0], z: floor[1], y: 0 };
  }

  /** 광선과 높이 y 수평면이 만나는 점(바닥 평면 좌표). */
  private planeHit(ray: Three.Ray, y: number): Vec2 | null {
    const point = ray.intersectPlane(new this.three.Plane(new this.three.Vector3(0, 1, 0), -y), new this.three.Vector3());
    return point ? [point.x, point.z] : null;
  }

  /** 광선이 처음 맞는 방 면이 벽이면 그 점과 방 안쪽을 보는 법선. 바닥·천장이 먼저 맞으면 null. */
  private wallHit(): { point: Three.Vector3; normal: Three.Vector3 } | null {
    const ray = this.raycaster.ray;
    for (const hit of this.raycaster.intersectObjects(this.roomGroup.children, false)) {
      const mesh = hit.object as Three.Mesh;
      if (!mesh.isMesh || !mesh.visible || !hit.face || mesh.material instanceof this.three.ShadowMaterial) continue;
      const normal = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
      if (normal.dot(ray.direction) > 0) normal.negate();
      if (Math.abs(normal.y) >= 0.3) return null;
      return { point: hit.point, normal: normal.setY(0).normalize() };
    }
    return null;
  }

  /** 광선이 처음 맞는 가구 면이 윗면(선반 칸 포함)이면 그 위 자리. 옆면이 먼저 맞으면 null. */
  private surfaceHit(ignore: ReadonlySet<number>): FurniturePlacement | null {
    const floorY = -this.state.cameraHeight;
    const objects = this.furnitureObjects.filter((object, index): object is Three.Group => !!object && !ignore.has(index));
    this.furnitureGroup.updateMatrixWorld(true);
    for (const hit of this.raycaster.intersectObjects(objects, true)) {
      const mesh = hit.object as Three.Mesh;
      if (!mesh.isMesh || !hit.face) continue;
      const normal = hit.face.normal.clone().transformDirection(mesh.matrixWorld);
      if (normal.y < 0.6) return null;
      if (!pointInPolygon([hit.point.x, hit.point.z], this.state.outer)) return null;
      return { x: hit.point.x, z: hit.point.z, y: hit.point.y - floorY };
    }
    return null;
  }

  /** `index` 가구 위(윗면·선반 칸)에 올려 둔 바닥 소품들 — 그 위의 것까지. */
  private stackedOn(index: number): number[] {
    const result: number[] = [];
    const visit = (baseIndex: number) => {
      const base = this.furnitureObjects[baseIndex];
      const baseItem = this.furniture[baseIndex];
      if (!base || !baseItem) return;
      base.updateMatrixWorld(true);
      const box = localFurnitureBox(this.three, base);
      if (box.isEmpty()) return;
      const inverse = base.matrixWorld.clone().invert();
      const floorY = -this.state.cameraHeight;
      const baseY = baseItem.y ?? 0;
      this.furniture.forEach((item, j) => {
        if (j === index || result.includes(j) || furnitureMount(findFurniture(item.type)) !== "floor") return;
        const y = item.y ?? 0;
        if (y <= baseY + 0.02) return;
        const local = new this.three.Vector3(item.x, floorY + y + 0.01, item.z).applyMatrix4(inverse);
        const inside = local.x >= box.min.x && local.x <= box.max.x && local.z >= box.min.z && local.z <= box.max.z && local.y <= box.max.y + 0.05;
        if (!inside) return;
        result.push(j);
        visit(j);
      });
    };
    visit(index);
    return result;
  }

  private startDrag(event: PointerEvent, index: number): FurnitureDrag | null {
    const item = this.furniture[index];
    if (!item) return null;
    const onFloor = furnitureMount(findFurniture(item.type)) === "floor" && (item.y ?? 0) <= 0.005;
    const hit = onFloor ? this.floorHit(event) : null;
    const children = this.stackedOn(index).map((j) => {
      const child = this.furniture[j];
      return { index: j, dx: child.x - item.x, dz: child.z - item.z, dy: (child.y ?? 0) - (item.y ?? 0) };
    });
    return {
      index,
      offset: hit ? [item.x - hit[0], item.z - hit[1]] : [0, 0],
      children,
      ignore: new Set([index, ...children.map((child) => child.index)]),
    };
  }

  private dragTo(event: PointerEvent, drag: FurnitureDrag) {
    const item = this.furniture[drag.index];
    if (!item) return;
    const placement = this.placementAt(event, item.type, drag.ignore, item);
    if (!placement) return;
    let { x, z } = placement;
    // 바닥에 놓는 가구는 누른 점과 중심의 차이를 유지한다(큰 가구가 손가락 밑으로 튀지 않게)
    if (furnitureMount(findFurniture(item.type)) === "floor" && placement.y <= 0.005) {
      x += drag.offset[0];
      z += drag.offset[1];
      if (!pointInPolygon([x, z], this.state.outer)) return;
    }
    const rotation = placement.rotation ?? item.rotation;
    const moves: FurnitureMove[] = [{ index: drag.index, x, z, y: placement.y, rotation }];
    for (const child of drag.children) {
      const childItem = this.furniture[child.index];
      if (!childItem) continue;
      moves.push({ index: child.index, x: x + child.dx, z: z + child.dz, y: placement.y + child.dy, rotation: childItem.rotation });
    }
    this.callbacks.onFurnitureMove?.(moves);
  }

  private settleQueued = false;

  /** 다음 틈에 한 번 내려앉힌다(같은 틈에 여러 번 불려도 한 번). */
  private scheduleSettle() {
    if (this.settleQueued) return;
    this.settleQueued = true;
    queueMicrotask(() => {
      this.settleQueued = false;
      this.settle();
    });
  }

  /**
   * 가구 위에 올린 소품 중 받침이 사라졌거나(지움·옮김) 높이가 달라진 것을 바로 밑 면(없으면 바닥)으로 내려앉힌다.
   * 모델을 받는 중이면(받침이 아직 상자라 높이가 다를 수 있다) 다 받은 뒤에 한다.
   */
  private settle() {
    if (this.disposed || this.loadingFurniture > 0 || this.pointer?.drag) return;
    const three = this.three;
    const floorY = -this.state.cameraHeight;
    const raycaster = new three.Raycaster();
    raycaster.params.Line = { threshold: 0.01 };
    const down = new three.Vector3(0, -1, 0);
    this.furnitureGroup.updateMatrixWorld(true);
    const moves: FurnitureMove[] = [];
    this.furniture.forEach((item, index) => {
      const y = item.y ?? 0;
      if (y <= 0.005 || furnitureMount(findFurniture(item.type)) !== "floor") return;
      raycaster.set(new three.Vector3(item.x, floorY + y + 0.03, item.z), down);
      const others = this.furnitureObjects.filter((object, j): object is Three.Group => !!object && j !== index);
      let support = 0;
      for (const hit of raycaster.intersectObjects(others, true)) {
        const mesh = hit.object as Three.Mesh;
        if (!mesh.isMesh || !hit.face) continue;
        if (hit.face.normal.clone().transformDirection(mesh.matrixWorld).y < 0.6) continue;
        support = hit.point.y - floorY;
        break;
      }
      if (Math.abs(support - y) > 0.01) moves.push({ index, x: item.x, z: item.z, y: support, rotation: item.rotation });
    });
    if (moves.length) this.callbacks.onFurnitureMove?.(moves);
  }

  /**
   * 누른 곳의 가구 번호. 메시에 맞으면 그 가구, 아니면 가구마다의 상자(회전 따라감)로 다시 본다 —
   * 의자 등받이 사이·선반 칸처럼 모델의 빈 곳을 눌러도 고를 수 있게.
   */
  private furnitureAt(event: PointerEvent): number | null {
    this.setRay(event);
    const hits = this.raycaster.intersectObjects(this.furnitureGroup.children, true);
    if (hits.length) {
      let object: Three.Object3D = hits[0].object;
      while (object.parent && object.parent !== this.furnitureGroup) object = object.parent;
      if (typeof object.userData.index === "number") return object.userData.index;
    }
    return nearestFurnitureBox(this.three, this.raycaster.ray, this.furnitureObjects);
  }

  /** 화면에서 손가락·마우스 가까이 있는 모서리 번호. 없으면 -1. */
  private cornerNear(event: PointerEvent): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const floorY = -this.state.cameraHeight;
    let best = -1;
    let bestDistance = MARKER_PICK_PX;
    this.state.outer.forEach(([x, z], i) => {
      const v = new this.three.Vector3(x, floorY, z).project(this.photoCamera);
      if (v.z > 1) return;
      const sx = ((v.x + 1) / 2) * rect.width + rect.left;
      const sy = ((1 - v.y) / 2) * rect.height + rect.top;
      const distance = Math.hypot(sx - event.clientX, sy - event.clientY);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  private handlePointerDown = (event: PointerEvent) => {
    const corner = this.view === "photo" && this.pickMode === "corners" && this.state.corners.length > 0 ? this.cornerNear(event) : -1;
    let drag: FurnitureDrag | null = null;

    if (corner < 0 && this.furnitureEditable && this.view !== "walk" && !this.placingType) {
      const index = this.furnitureAt(event);
      if (index !== null) {
        this.callbacks.onFurnitureSelect?.(index);
        drag = this.startDrag(event, index);
        this.controls.enabled = false;
      }
    }

    this.pointer = {
      x: event.clientX,
      y: event.clientY,
      yaw: this.yaw,
      pitch: this.pitch,
      walkYaw: this.walk.yaw,
      walkPitch: this.walk.pitch,
      moved: false,
      corner,
      drag,
    };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent) => {
    const pointer = this.pointer;
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) pointer.moved = true;
    if (!pointer.moved) return;

    if (pointer.drag) {
      this.dragTo(event, pointer.drag);
      return;
    }

    if (this.view === "photo" && pointer.corner >= 0) {
      const direction = this.directionAt(event);
      if (direction[1] < -0.03) {
        const corners = this.state.corners.map((c) => [c[0], c[1]] as Vec2);
        corners[pointer.corner] = directionToUv(direction);
        this.callbacks.onCornersChange?.(corners);
      }
      return;
    }

    if (this.view === "walk") {
      const k = (this.walkCamera.fov * Math.PI) / 180 / this.renderer.domElement.clientHeight;
      this.walk.yaw = pointer.walkYaw - dx * k;
      this.walk.pitch = Math.max(-1.3, Math.min(1.3, pointer.walkPitch + dy * k));
    } else if (this.view === "photo") {
      const k = (this.photoCamera.fov * Math.PI) / 180 / this.renderer.domElement.clientHeight;
      this.yaw = pointer.yaw - dx * k;
      this.pitch = Math.max(-1.5, Math.min(1.5, pointer.pitch + dy * k));
    }
  };

  private handlePointerUp = (event: PointerEvent) => {
    const pointer = this.pointer;
    this.pointer = null;
    this.controls.enabled = this.view === "miniature";
    if (!pointer) return;
    if (pointer.drag) {
      if (pointer.moved) {
        this.callbacks.onFurnitureDragEnd?.();
        this.scheduleSettle();
      }
      return;
    }
    if (pointer.moved || pointer.corner >= 0) return;
    this.handleClick(event);
  };

  private handleClick(event: PointerEvent) {
    if (this.view === "walk") {
      const hit = this.floorHit(event);
      if (hit && canStand(hit, this.walkArea())) this.walk.target = hit;
      else this.callbacks.onHint?.("그곳으로는 갈 수 없어요.");
      return;
    }

    if (this.placingType) {
      const placement = this.placementAt(event, this.placingType, new Set());
      if (!placement) {
        const mount = furnitureMount(findFurniture(this.placingType));
        this.callbacks.onHint?.(mount === "wall" ? "방 안쪽 벽을 눌러 주세요." : "방 안쪽을 눌러 주세요.");
        return;
      }
      this.callbacks.onPlace?.(placement);
      return;
    }

    if (this.view === "photo" && this.texture && this.pickMode !== "none") {
      const direction = this.directionAt(event);
      if (this.pickMode === "corners") {
        if (direction[1] > -0.03) {
          this.callbacks.onHint?.("바닥과 벽이 만나는 모서리를 눌러 주세요.");
          return;
        }
        this.callbacks.onCornersChange?.([...this.state.corners.map((c) => [c[0], c[1]] as Vec2), directionToUv(direction)]);
      } else {
        this.callbacks.onCeilingPick?.(directionToUv(direction));
      }
      return;
    }

    if (this.furnitureEditable) this.callbacks.onFurnitureSelect?.(null);
  }

  private handlePointerCancel = () => {
    this.pointer = null;
    this.controls.enabled = this.view === "miniature";
  };

  private handleWheel = (event: WheelEvent) => {
    if (this.view === "miniature") return;
    event.preventDefault();
    const camera = this.activeCamera();
    camera.fov = Math.max(30, Math.min(100, camera.fov + event.deltaY * 0.03));
    camera.updateProjectionMatrix();
  };

  // ---------- 그리기 ----------

  private resize() {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    for (const camera of [this.photoCamera, this.miniatureCamera, this.walkCamera]) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  private tick = (timestamp?: number) => {
    this.frame = requestAnimationFrame(this.tick);
    this.timer.update(timestamp);
    const dt = Math.min(0.05, this.timer.getDelta());
    if (this.loadingFurniture > 0) {
      // 스켈레톤처럼 천천히 숨 쉬듯 깜빡인다(약 1.2초 주기)
      const wave = 0.5 + 0.5 * Math.sin(this.timer.getElapsed() * 5.2);
      this.furnitureMaterials.ghost.opacity = 0.15 + 0.35 * wave;
      this.ghostLineMaterial.opacity = 0.45 + 0.5 * wave;
    }
    if (this.view === "photo") {
      const cp = Math.cos(this.pitch);
      this.photoCamera.position.set(0, 0, 0);
      this.photoCamera.lookAt(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    } else if (this.view === "walk") {
      this.updateWalk(dt);
    } else {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.activeCamera());
  };
}

/** 방 만들기 화면 — 모서리 사진 좌표에서 바닥 다각형을 계산한다(바닥이 아닌 점은 건너뛴다). */
export function outerOfCorners(corners: readonly Vec2[], cameraHeight: number): Vec2[] {
  const points: Vec2[] = [];
  for (const corner of corners) {
    const point = floorPointFromUv(corner, cameraHeight);
    if (point) points.push(point);
  }
  return points;
}
