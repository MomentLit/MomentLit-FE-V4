import type * as Three from "three";
import type { OrbitControls as OrbitControlsType } from "three/examples/jsm/controls/OrbitControls.js";
import {
  centroid,
  directionToUv,
  floorPointFromUv,
  signedArea,
  wallLengths,
  type Vec2,
  type Vec3,
} from "./geometry";

/**
 * 파노라마 방 3D 무대 — 렌더러·카메라·포인터를 React 밖에서 관리한다(프로토타입 panorama-room.html 이식).
 *
 * 좌표: 사진을 찍은 눈 위치가 원점, 바닥은 y = -촬영 높이, 천장은 y = 천장 - 촬영 높이.
 * 벽·바닥·천장은 셰이더로 "그 점을 카메라에서 본 방향의 사진 픽셀"을 칠한다 — 사진 시점에서는 사진과 똑같이 보이고,
 * 미니어처 시점에서는 사진이 벽에 붙은 모형이 된다.
 */

type ThreeModule = typeof Three;
type OrbitControlsClass = new (camera: Three.Camera, element: HTMLElement) => OrbitControlsType;

export type RoomView = "photo" | "miniature";
/** 사진 시점에서 누르기의 의미 — 바닥 모서리 찍기 / 천장 모서리 찍기(높이 재기) / 둘러보기만. */
export type PickMode = "corners" | "ceiling" | "none";

export interface RoomStageState {
  corners: readonly Vec2[];
  cameraHeight: number;
  ceilingHeight: number;
}

export interface RoomStageCallbacks {
  /** 모서리를 추가하거나 끌어서 옮겼을 때. */
  onCornersChange?: (corners: Vec2[]) => void;
  /** 천장 모드에서 누른 사진 좌표. */
  onCeilingPick?: (uv: Vec2) => void;
  /** 사용자에게 보여 줄 짧은 안내(잘못 누름 등). */
  onHint?: (message: string) => void;
}

const TAPE = 0xf2bc2e;
const MARKER_PICK_PX = 22;
const DRAG_THRESHOLD_PX = 5;
const STAGE_BACKGROUND = 0xd9dcd6;

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

export class RoomStage {
  private readonly three: ThreeModule;
  private readonly container: HTMLElement;
  private readonly callbacks: RoomStageCallbacks;
  private readonly renderer: Three.WebGLRenderer;
  private readonly scene: Three.Scene;
  private readonly photoCamera: Three.PerspectiveCamera;
  private readonly miniatureCamera: Three.PerspectiveCamera;
  private readonly controls: OrbitControlsType;
  private readonly raycaster: Three.Raycaster;
  private readonly roomMaterial: Three.ShaderMaterial;
  private readonly skyMaterial: Three.ShaderMaterial;
  private readonly sky: Three.Mesh;
  private readonly roomGroup: Three.Group;
  private readonly markerGroup: Three.Group;
  private readonly labelGroup: Three.Group;
  private readonly resizeObserver: ResizeObserver;
  private ceilingMesh: Three.Mesh | null = null;
  private texture: Three.Texture | null = null;
  private frame = 0;
  private disposed = false;

  private state: RoomStageState = { corners: [], cameraHeight: 1.5, ceilingHeight: 2.4 };
  private view: RoomView = "photo";
  private pickMode: PickMode = "corners";
  private yaw = 0;
  private pitch = -0.3;
  private miniaturePlaced = false;
  private pointer: {
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    moved: boolean;
    corner: number;
  } | null = null;

  constructor(three: ThreeModule, OrbitControls: OrbitControlsClass, container: HTMLElement, callbacks: RoomStageCallbacks = {}) {
    this.three = three;
    this.container = container;
    this.callbacks = callbacks;

    this.renderer = new three.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.touchAction = "none";
    container.appendChild(this.renderer.domElement);

    this.scene = new three.Scene();
    this.photoCamera = new three.PerspectiveCamera(75, 1, 0.01, 200);
    this.miniatureCamera = new three.PerspectiveCamera(45, 1, 0.05, 200);
    this.raycaster = new three.Raycaster();

    const uniforms = { panorama: { value: null as Three.Texture | null }, eye: { value: new three.Vector3() } };
    this.roomMaterial = new three.ShaderMaterial({ uniforms, vertexShader: VERTEX_SHADER, fragmentShader: FRAGMENT_SHADER });
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

    this.roomGroup = new three.Group();
    this.markerGroup = new three.Group();
    this.labelGroup = new three.Group();
    this.scene.add(this.roomGroup, this.markerGroup, this.labelGroup);

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
    if (view === "miniature" && this.state.corners.length < 3) return;
    this.view = view;
    this.applyView();
  }

  setPickMode(mode: PickMode) {
    this.pickMode = mode;
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
    this.controls.dispose();
    this.clearGroup(this.roomGroup);
    this.clearGroup(this.markerGroup);
    this.clearGroup(this.labelGroup);
    this.sky.geometry.dispose();
    this.roomMaterial.dispose();
    this.skyMaterial.dispose();
    this.texture?.dispose();
    this.renderer.dispose();
    canvas.remove();
  }

  // ---------- 장면 만들기 ----------

  private floorPoints(): Vec2[] {
    const points: Vec2[] = [];
    for (const corner of this.state.corners) {
      const point = floorPointFromUv(corner, this.state.cameraHeight);
      if (point) points.push(point);
    }
    return points;
  }

  private rebuild() {
    const three = this.three;
    const { cameraHeight, ceilingHeight } = this.state;
    const floorY = -cameraHeight;
    const ceilingY = ceilingHeight - cameraHeight;
    const points = this.floorPoints();

    this.clearGroup(this.markerGroup);
    this.clearGroup(this.roomGroup);
    this.clearGroup(this.labelGroup);
    this.ceilingMesh = null;

    // 모서리 표시(사진 시점)
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

    if (points.length < 3 || ceilingY <= 0.05) {
      if (this.view === "miniature") {
        this.view = "photo";
        this.applyView();
      }
      return;
    }

    // 바닥(ShapeGeometry는 xy 평면 → x축으로 눕힌다)
    const floorGeometry = new three.ShapeGeometry(new three.Shape(points.map(([x, z]) => new three.Vector2(x, -z))));
    floorGeometry.rotateX(-Math.PI / 2);
    floorGeometry.translate(0, floorY, 0);
    this.roomGroup.add(new three.Mesh(floorGeometry, this.roomMaterial));

    const ceilingGeometry = new three.ShapeGeometry(new three.Shape(points.map(([x, z]) => new three.Vector2(x, z))));
    ceilingGeometry.rotateX(Math.PI / 2);
    ceilingGeometry.translate(0, ceilingY, 0);
    this.ceilingMesh = new three.Mesh(ceilingGeometry, this.roomMaterial);
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
      this.roomGroup.add(new three.Mesh(geometry, this.roomMaterial));

      const label = this.makeLabel(`${lengths[i].toFixed(2)}m`, true);
      label.position.set((a[0] + b[0]) / 2, floorY + 0.08, (a[1] + b[1]) / 2);
      this.labelGroup.add(label);
    });

    if (!this.miniaturePlaced) {
      this.placeMiniatureCamera(points, floorY);
      this.miniaturePlaced = true;
    }
    this.applyView();
  }

  private placeMiniatureCamera(points: Vec2[], floorY: number) {
    const [cx, cz] = centroid(points);
    const span = Math.max(...points.map(([x, z]) => Math.hypot(x - cx, z - cz)));
    this.miniatureCamera.position.set(cx + span * 0.4, floorY + span * 1.6 + 2.5, cz + span * 1.5 + 1.5);
    this.controls.target.set(cx, floorY + 0.4, cz);
    this.controls.update();
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

  private clearGroup(group: Three.Group) {
    group.traverse((object) => {
      const mesh = object as Three.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material as Three.Material | Three.Material[] | undefined;
      for (const m of Array.isArray(material) ? material : material ? [material] : []) {
        if (m === this.roomMaterial) continue;
        (m as Three.SpriteMaterial).map?.dispose();
        m.dispose();
      }
    });
    group.clear();
  }

  private applyView() {
    const photo = this.view === "photo";
    this.sky.visible = photo && !!this.texture;
    if (this.ceilingMesh) this.ceilingMesh.visible = photo;
    this.markerGroup.visible = photo;
    this.labelGroup.visible = !photo;
    this.controls.enabled = !photo;
    this.scene.background = photo ? null : new this.three.Color(STAGE_BACKGROUND);
  }

  // ---------- 포인터 ----------

  private activeCamera() {
    return this.view === "photo" ? this.photoCamera : this.miniatureCamera;
  }

  private directionAt(event: PointerEvent): Vec3 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new this.three.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.activeCamera());
    const d = this.raycaster.ray.direction.normalize();
    return [d.x, d.y, d.z];
  }

  /** 화면에서 손가락·마우스 가까이 있는 모서리 번호. 없으면 -1. */
  private cornerNear(event: PointerEvent): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const floorY = -this.state.cameraHeight;
    let best = -1;
    let bestDistance = MARKER_PICK_PX;
    this.state.corners.forEach((corner, i) => {
      const point = floorPointFromUv(corner, this.state.cameraHeight);
      if (!point) return;
      const v = new this.three.Vector3(point[0], floorY, point[1]).project(this.photoCamera);
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
    const corner = this.view === "photo" && this.pickMode === "corners" ? this.cornerNear(event) : -1;
    this.pointer = { x: event.clientX, y: event.clientY, yaw: this.yaw, pitch: this.pitch, moved: false, corner };
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent) => {
    const pointer = this.pointer;
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) pointer.moved = true;
    if (!pointer.moved || this.view !== "photo") return;

    if (pointer.corner >= 0) {
      const direction = this.directionAt(event);
      if (direction[1] < -0.03) {
        const corners = this.state.corners.map((c) => [c[0], c[1]] as Vec2);
        corners[pointer.corner] = directionToUv(direction);
        this.callbacks.onCornersChange?.(corners);
      }
      return;
    }

    const k = (this.photoCamera.fov * Math.PI) / 180 / this.renderer.domElement.clientHeight;
    this.yaw = pointer.yaw - dx * k;
    this.pitch = Math.max(-1.5, Math.min(1.5, pointer.pitch + dy * k));
  };

  private handlePointerUp = (event: PointerEvent) => {
    const pointer = this.pointer;
    this.pointer = null;
    if (!pointer || pointer.moved || pointer.corner >= 0 || this.view !== "photo" || !this.texture) return;

    const direction = this.directionAt(event);
    if (this.pickMode === "corners") {
      if (direction[1] > -0.03) {
        this.callbacks.onHint?.("바닥과 벽이 만나는 모서리를 눌러 주세요.");
        return;
      }
      this.callbacks.onCornersChange?.([...this.state.corners.map((c) => [c[0], c[1]] as Vec2), directionToUv(direction)]);
    } else if (this.pickMode === "ceiling") {
      this.callbacks.onCeilingPick?.(directionToUv(direction));
    }
  };

  private handlePointerCancel = () => {
    this.pointer = null;
  };

  private handleWheel = (event: WheelEvent) => {
    if (this.view !== "photo") return;
    event.preventDefault();
    this.photoCamera.fov = Math.max(30, Math.min(100, this.photoCamera.fov + event.deltaY * 0.03));
    this.photoCamera.updateProjectionMatrix();
  };

  // ---------- 그리기 ----------

  private resize() {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    for (const camera of [this.photoCamera, this.miniatureCamera]) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  private tick = () => {
    this.frame = requestAnimationFrame(this.tick);
    if (this.view === "photo") {
      const cp = Math.cos(this.pitch);
      this.photoCamera.position.set(0, 0, 0);
      this.photoCamera.lookAt(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    } else {
      this.controls.update();
    }
    this.renderer.render(this.scene, this.activeCamera());
  };
}
