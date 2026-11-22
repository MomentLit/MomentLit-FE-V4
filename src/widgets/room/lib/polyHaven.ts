import { MODEL_FURNITURE_PREFIX, type FurnitureCategory, type FurnitureDef, type FurnitureMount } from "./furniture";
import { POLY_HAVEN_KO_NAMES } from "./polyHavenNames";

/**
 * Poly Haven(CC0) 모델을 등록 없이 바로 쓴다 — 목록·썸네일은 API에서, 모델은 놓을 때 glTF(1k)를 받는다.
 * 실내에 둘 만한 것(가구·조명·가전·장식·소품)만 골라, 바닥/벽/천장 중 어디에 놓을지도 여기서 정한다.
 * API 약관: 라이브 API를 쓰면 "Powered by Poly Haven" 표기가 필요하다(FurniturePicker에 있다).
 * https://github.com/Poly-Haven/Public-API
 */
export const POLY_HAVEN_API = "https://api.polyhaven.com";

/** Poly Haven 에셋 id → 우리 가구 id(BE 검증 [a-z0-9-]{1,40}). 저장된 배치가 이 값을 쓰므로 바꾸지 말 것. */
export function toFurnitureId(assetId: string): string {
  return MODEL_FURNITURE_PREFIX + assetId.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;

export interface PolyHavenAsset {
  name?: string;
  categories?: string[];
  tags?: string[];
  dimensions?: number[];
  thumbnail_url?: string;
  download_count?: number;
}

/** 실내 물건으로 볼 분류. 하나라도 있어야 후보가 된다. */
const INDOOR = ["furniture", "lighting", "electronics", "appliances", "decorative", "potted plants", "vases", "wall decoration", "office", "instrument", "props", "dishes", "food", "containers"];
/** 이 분류가 있으면 뺀다(자연·건물·배 등). */
const OUTSIDE = ["nature", "rocks", "trees", "ground cover", "structures", "buildings", "ships", "grass"];
/** 이 분류는 낱말 거르기를 건너뛴다 — 태그에 outdoor가 붙은 의자·화분도 실내에 둘 수 있다. */
const ALWAYS_KEEP = ["furniture", "vases", "potted plants"];
/** 이름·태그에 있으면 뺀다(무기·공구 상자·야외 물건·쓰레기 등). */
const EXCLUDE_WORDS = [
  "exterior", "outdoor", "street", "garden", "fire pit", "picnic", "sprinkler", "lifebuoy", "fire alarm", "hose", "barrel",
  "pallet", "crate", "tractor", "boat", "military", "weapon", "gun", "sword", "scaffold", "road", "traffic", "dumpster",
  "manhole", "fence", "generator", "spray", "trash", "security light", "searchlight",
];

function searchText(assetId: string, asset: PolyHavenAsset) {
  return [assetId.replace(/_/g, " "), asset.name ?? "", ...(asset.tags ?? [])].join(" ").toLowerCase();
}

/** 어디에 놓나 — 천장 조명·선풍기는 천장, 액자·거울·벽시계·벽등은 벽, 나머지는 바닥. */
export function polyHavenMount(assetId: string, asset: PolyHavenAsset): FurnitureMount {
  const text = searchText(assetId, asset);
  if (/\b(standing|floor lamp|table lamp|desk lamp)\b/.test(text)) return "floor";
  if (/ceiling|chandelier|pendant|fluorescent|hanging (industrial )?(light|lamp)|caged hanging|light socket/.test(text)) return "ceiling";
  if ((asset.categories ?? []).includes("wall decoration") || /wall[ -]?(clock|mounted|lamp|light|shelf)|sconce|picture frame|painting|mirror/.test(text)) {
    return "wall";
  }
  return "floor";
}

function category(categories: readonly string[]): FurnitureCategory {
  if (categories.includes("bed")) return "bed";
  if (categories.includes("seating")) return "seating";
  if (categories.includes("table")) return "table";
  if (categories.includes("shelves")) return "storage";
  if (categories.includes("lighting")) return "lighting";
  if (categories.includes("electronics") || categories.includes("appliances")) return "electronics";
  if (["decorative", "vases", "potted plants", "wall decoration"].some((c) => categories.includes(c))) return "decor";
  if (categories.includes("furniture")) return "storage";
  return "props";
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** 에셋 하나 → 가구. 실내 물건이 아니거나 너무 작고 크면 null. */
export function polyHavenFurniture(assetId: string, asset: PolyHavenAsset): FurnitureDef | null {
  const categories = asset.categories ?? [];
  if (!categories.some((c) => INDOOR.includes(c)) || categories.some((c) => OUTSIDE.includes(c))) return null;
  const id = toFurnitureId(assetId);
  // dimensions는 Blender 좌표 mm [x, y(깊이), z(높이)] — glTF로는 x 그대로, 깊이가 z, 높이가 y
  const [x, y, z] = Array.isArray(asset.dimensions) ? asset.dimensions : [];
  if (!ID_PATTERN.test(id) || ![x, y, z].every((v) => typeof v === "number" && v > 0)) return null;
  const width = x / 1000;
  const depth = y / 1000;
  const height = z / 1000;
  if (Math.max(width, depth, height) < 0.1 || Math.max(width, depth) > 4 || height > 3.2) return null;
  const text = searchText(assetId, asset);
  if (!categories.some((c) => ALWAYS_KEEP.includes(c)) && EXCLUDE_WORDS.some((word) => text.includes(word))) return null;
  return {
    id,
    // 한국어 이름이 있으면 그걸 보여 주고, 영어 이름은 찾기용으로 태그에 넣는다
    name: POLY_HAVEN_KO_NAMES[assetId] ?? asset.name ?? assetId,
    width: round(width),
    depth: round(depth),
    height: round(height),
    polyHavenId: assetId,
    thumbnail: asset.thumbnail_url,
    category: category(categories),
    mount: polyHavenMount(assetId, asset),
    tags: [asset.name ?? assetId, ...(asset.tags ?? [])],
  };
}

/** `/assets?t=models` 응답 → 실내 물건 목록(많이 받은 순). */
export function parsePolyHavenAssets(data: unknown): FurnitureDef[] {
  if (!data || typeof data !== "object") throw new Error("Poly Haven 모델 목록 형식이 맞지 않아요.");
  return Object.entries(data as Record<string, PolyHavenAsset>)
    .sort(([, a], [, b]) => (b.download_count ?? 0) - (a.download_count ?? 0))
    .map(([assetId, asset]) => polyHavenFurniture(assetId, asset))
    .filter((def): def is FurnitureDef => def !== null);
}

export async function fetchPolyHavenFurniture(): Promise<FurnitureDef[]> {
  const response = await fetch(`${POLY_HAVEN_API}/assets?t=models`);
  if (!response.ok) throw new Error(`Poly Haven 모델 목록을 받지 못했어요 (${response.status}).`);
  return parsePolyHavenAssets(await response.json());
}

export interface PolyHavenGltf {
  url: string;
  /** .gltf 안 상대 경로 → 실제 파일 주소. 실제 파일은 다른 폴더에 있어서(bin은 4k 폴더 등) 이걸로 바꿔 받아야 한다. */
  include: Record<string, string>;
}

export async function fetchPolyHavenGltf(assetId: string, resolution = "1k"): Promise<PolyHavenGltf> {
  const response = await fetch(`${POLY_HAVEN_API}/files/${encodeURIComponent(assetId)}`);
  if (!response.ok) throw new Error(`Poly Haven 모델 정보를 받지 못했어요 (${response.status}).`);
  const files = await response.json();
  const entry = files?.gltf?.[resolution]?.gltf;
  if (typeof entry?.url !== "string") throw new Error(`${assetId}: ${resolution} glTF가 없어요.`);
  const include: Record<string, string> = {};
  for (const [path, file] of Object.entries((entry.include ?? {}) as Record<string, { url?: string }>)) {
    if (typeof file?.url === "string") include[path] = file.url;
  }
  return { url: entry.url, include };
}

/** GLTFLoader가 요청하는 주소(.gltf 폴더 + 상대 경로)를 include의 실제 주소로 바꾼다. */
export function polyHavenUrlModifier(gltf: PolyHavenGltf): (url: string) => string {
  const base = gltf.url.slice(0, gltf.url.lastIndexOf("/") + 1);
  return (url) => {
    if (!url.startsWith(base)) return url;
    const relative = decodeURIComponent(url.slice(base.length));
    return gltf.include[relative] ?? url;
  };
}
