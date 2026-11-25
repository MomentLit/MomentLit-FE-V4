"use client";

import { useDeferredValue, useEffect, useMemo, useState, type ComponentType } from "react";
import { apiClient } from "@/shared/api";
import {
  IconAlertTriangle,
  IconArchive,
  IconArmchair,
  IconBed,
  IconBulb,
  IconDeviceTv,
  IconHomeHeart,
  IconLayoutGrid,
  IconLoader2,
  IconLogin,
  IconPackage,
  IconPlant2,
  IconPlus,
  IconSearch,
  IconShape,
  IconTable,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import type { CustomFurniture } from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { cn } from "@/shared/lib";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { FURNITURE_CATALOG, type FurnitureCategory, type FurnitureDef } from "../lib/furniture";

type Filter = "all" | "mine" | FurnitureCategory | "basic";

/**
 * 종류마다 사이트 스펙트럼 색 — 아이콘 칸 바탕과 고른 표시에 쓴다(색 위 글자는 늘 ink).
 * Tailwind가 클래스를 찾을 수 있게 이름을 통째로 적는다.
 */
const TONE = {
  ink: { tile: "bg-ink text-white", bar: "bg-ink", soft: "bg-line" },
  sky: { tile: "bg-sky text-ink", bar: "bg-sky", soft: "bg-sky/25" },
  lime: { tile: "bg-lime text-ink", bar: "bg-lime", soft: "bg-lime/25" },
  lemon: { tile: "bg-lemon text-ink", bar: "bg-lemon", soft: "bg-lemon/30" },
  coral: { tile: "bg-coral text-ink", bar: "bg-coral", soft: "bg-coral/25" },
  rose: { tile: "bg-rose text-ink", bar: "bg-rose", soft: "bg-rose/25" },
  violet: { tile: "bg-violet text-ink", bar: "bg-violet", soft: "bg-violet/25" },
  plain: { tile: "bg-line-2 text-ink", bar: "bg-line-2", soft: "bg-line" },
} as const;
type Tone = keyof typeof TONE;

const FILTERS: readonly { id: Filter; label: string; tone: Tone; icon: ComponentType<{ size?: number; stroke?: number; "aria-hidden"?: boolean }> }[] = [
  { id: "all", label: "전체", tone: "ink", icon: IconLayoutGrid },
  { id: "mine", label: "내 가구", tone: "rose", icon: IconHomeHeart },
  { id: "seating", label: "소파·의자", tone: "sky", icon: IconArmchair },
  { id: "table", label: "테이블", tone: "coral", icon: IconTable },
  { id: "bed", label: "침대", tone: "violet", icon: IconBed },
  { id: "storage", label: "수납", tone: "lime", icon: IconArchive },
  { id: "lighting", label: "조명", tone: "lemon", icon: IconBulb },
  { id: "electronics", label: "가전", tone: "sky", icon: IconDeviceTv },
  { id: "decor", label: "장식", tone: "rose", icon: IconPlant2 },
  { id: "props", label: "소품", tone: "violet", icon: IconPackage },
  { id: "basic", label: "기본 도형", tone: "plain", icon: IconShape },
];

/** 한국어로 찾아도 영어 이름·태그(Poly Haven)에 걸리게 */
const SEARCH_ALIASES: Record<string, string[]> = {
  소파: ["sofa"], 의자: ["chair", "stool", "seat"], 스툴: ["stool"], 테이블: ["table"], 탁자: ["table"], 책상: ["desk"],
  침대: ["bed"], 선반: ["shelf", "shelves", "rack"], 수납: ["cabinet", "drawer", "commode", "shelves"], 서랍: ["drawer", "commode"],
  장: ["cabinet"], 거울: ["mirror"], 벤치: ["bench"], 조명: ["lamp", "light", "chandelier"], 램프: ["lamp"], 샹들리에: ["chandelier"],
  액자: ["frame", "picture"], 시계: ["clock"], 화분: ["plant", "pot"], 화병: ["vase"], 꽃병: ["vase"], 티비: ["television", "tv"],
  tv: ["television"], 텔레비전: ["television"], 책: ["book"], 선풍기: ["fan"], 컵: ["cup", "mug", "goblet"], 그릇: ["bowl", "plate"],
};

function matchesFilter(def: FurnitureDef, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "mine") return def.custom === true;
  if (def.custom) return false;
  if (filter === "basic") return !def.model && !def.polyHavenId;
  return def.category === filter;
}

function matchesQuery(def: FurnitureDef, query: string) {
  if (!query) return true;
  const haystack = [def.name, ...(def.tags ?? [])].join(" ").toLowerCase();
  const words = [query, ...Object.entries(SEARCH_ALIASES).filter(([ko]) => query.includes(ko)).flatMap(([, en]) => en)];
  return words.some((word) => haystack.includes(word));
}

interface PickerProps {
  items: readonly FurnitureDef[];
  loading: boolean;
  failed: boolean;
  usesPolyHaven: boolean;
  placingType: string | null;
  disabled: boolean;
  note?: string;
  onPick: (id: string) => void;
  /** 내 가구 전체(만드는 중·실패 포함). 다 만든 것은 `items`에도 들어 있다. */
  mine: readonly CustomFurniture[];
  signedIn: boolean;
  onAddMine: () => void;
  onDeleteMine: (id: number) => Promise<void>;
  onRequireLogin: () => void;
  /**
   * `rail`: 넓은 왼쪽 칸 — 왼쪽에 세로 종류 막대, 오른쪽에 목록(따로 스크롤). 부모가 높이를 정해야 한다.
   * `compact`: 좁은 화면의 아래 패널 — 종류는 가로로 넘기는 칩.
   */
  layout?: "rail" | "compact";
  className?: string;
}

/**
 * 가구 고르기 — 찾기 + 종류 + 썸네일 목록. 모델은 놓을 때 받으므로 여기서는 썸네일만 받는다.
 * 찾기 시작하면 종류는 "전체"로 돌아가고, 종류마다 찾은 개수가 보인다.
 */
export function FurniturePicker({
  items,
  loading,
  failed,
  usesPolyHaven,
  placingType,
  disabled,
  note,
  onPick,
  mine,
  signedIn,
  onAddMine,
  onDeleteMine,
  onRequireLogin,
  layout = "rail",
  className,
}: PickerProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [deleting, setDeleting] = useState<CustomFurniture | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  // "전체"에서도 가구 → 조명·가전 → 장식·소품 → 기본 도형 순으로(같은 종류 안에서는 받은 순서 = 인기순)
  const all = useMemo(() => {
    const order = (def: FurnitureDef) => {
      const index = FILTERS.findIndex((option) => option.id !== "all" && matchesFilter(def, option.id));
      return index < 0 ? FILTERS.length : index;
    };
    return [...items, ...FURNITURE_CATALOG]
      .map((def, index) => ({ def, index, rank: order(def) }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ def }) => def);
  }, [items]);
  const found = useMemo(() => all.filter((def) => matchesQuery(def, deferredQuery)), [all, deferredQuery]);
  // 내 가구 중 아직 놓을 수 없는 것(만드는 중·실패) — "내 가구"에서만 상태와 함께 보여 준다
  const pendingMine = useMemo(
    () => mine.filter((item) => item.status !== "READY" && matchesQuery({ id: item.type, name: item.name, width: 0, depth: 0 }, deferredQuery)),
    [mine, deferredQuery],
  );
  const counts = useMemo(() => new Map(FILTERS.map((option) => [
    option.id,
    found.filter((def) => matchesFilter(def, option.id)).length + (option.id === "mine" ? pendingMine.length : 0),
  ])), [found, pendingMine]);
  // 가구가 하나도 없는 종류는 숨긴다(찾기와 상관없이 전체 목록 기준). 내 가구는 늘 보인다(추가하는 곳)
  const filters = FILTERS.filter((option) => option.id === "all" || option.id === "mine" || all.some((def) => matchesFilter(def, option.id)));
  const mineById = useMemo(() => new Map(mine.map((item) => [item.type, item])), [mine]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDeleteMine(deleting.id);
      setDeleting(null);
    } catch (e) {
      setDeleteError(getErrorMessage(e));
    } finally {
      setDeleteBusy(false);
    }
  }
  const visible = found.filter((def) => matchesFilter(def, filter));
  const activeLabel = FILTERS.find((option) => option.id === filter)?.label ?? "전체";

  function changeQuery(next: string) {
    if (!query && next) setFilter("all");
    setQuery(next);
  }

  const search = (
    <label className="relative block">
      <span className="sr-only">가구 찾기</span>
      <IconSearch size={16} stroke={2} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-soft" />
      <input
        type="search"
        value={query}
        onChange={(event) => changeQuery(event.target.value)}
        placeholder={`가구 ${all.length}개에서 찾기`}
        className="h-10 w-full border border-line bg-white pl-9 pr-9 text-sm text-ink placeholder:text-soft focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {query && (
        <button
          type="button"
          onClick={() => changeQuery("")}
          aria-label="찾기 지우기"
          className="absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-soft hover:text-ink"
        >
          <IconX size={15} stroke={2} aria-hidden />
        </button>
      )}
    </label>
  );

  const grid = (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="truncate text-xs font-semibold text-ink">
          {deferredQuery ? `‘${query.trim()}’ 찾은 결과` : activeLabel}
        </p>
        <span className="shrink-0 text-xs text-soft">{visible.length}개</span>
      </div>
      {filter === "mine" && !signedIn ? (
        <div className="flex flex-col items-center gap-3 border border-dashed border-line-2 px-4 py-8 text-center">
          <IconHomeHeart size={28} stroke={1.5} aria-hidden className="text-soft" />
          <p className="text-sm text-soft">로그인하면 우리 집 가구를 사진이나 3D 파일로 만들어 놓아 볼 수 있어요.</p>
          <button type="button" onClick={onRequireLogin} className="button button--primary button--sm">
            <IconLogin size={15} stroke={2} aria-hidden />
            로그인
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="가구 목록">
          {filter === "mine" && (
            <button
              type="button"
              onClick={onAddMine}
              className="flex min-h-40 flex-col items-center justify-center gap-1.5 border border-dashed border-line-2 bg-white text-xs font-semibold text-ink hover:border-ink"
            >
              <IconPlus size={22} stroke={1.8} aria-hidden />
              가구 추가
              <span className="px-2 text-[0.62rem] font-normal text-soft">사진·3D 파일</span>
            </button>
          )}
          {filter === "mine" && pendingMine.map((item) => (
            <PendingCard key={item.type} item={item} onDelete={() => setDeleting(item)} />
          ))}
          {visible.map((def) => {
            const own = mineById.get(def.id);
            return (
              <FurnitureCard
                key={def.id}
                def={def}
                active={placingType === def.id}
                disabled={disabled}
                onPick={onPick}
                onDelete={own ? () => setDeleting(own) : undefined}
              />
            );
          })}
        </div>
      )}
      {visible.length === 0 && filter !== "mine" && (
        <p className="py-10 text-center text-sm text-soft">
          {deferredQuery && found.length > 0 ? `‘${activeLabel}’에는 없어요. 다른 종류에 ${found.length}개 있어요.` : "찾는 가구가 없어요."}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-1">
        {loading && <p className="text-xs text-soft">가구 목록을 불러오는 중…</p>}
        {failed && <p className="text-xs text-soft">가구 모델 목록을 불러오지 못해 기본 도형만 보여요.</p>}
        {note && <p className="text-xs text-soft">{note}</p>}
        {usesPolyHaven && (
          <p className="text-[0.7rem] text-soft">
            가구 모델은 놓을 때 받아요 ·{" "}
            <a href="https://polyhaven.com" target="_blank" rel="noreferrer" className="underline">Powered by Poly Haven</a> (CC0)
          </p>
        )}
      </div>
    </>
  );

  const deleteDialog = deleting && (
    <ConfirmDialog
      title="내 가구 지우기"
      confirmLabel="지우기"
      busyLabel="지우는 중…"
      busy={deleteBusy}
      error={deleteError}
      onConfirm={confirmDelete}
      onCancel={() => {
        setDeleting(null);
        setDeleteError(null);
      }}
    >
      <p className="text-sm text-soft">‘{deleting.name}’을(를) 지울까요? 이 가구를 놓아 둔 배치에서도 보이지 않게 돼요.</p>
    </ConfirmDialog>
  );

  if (layout === "compact") {
    return (
      <div className={cn("flex flex-col gap-3", className)}>
        {search}
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="tablist" aria-label="가구 종류">
          {filters.map((option) => {
            const Icon = option.icon;
            const selected = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(option.id)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 border px-2 pr-3 text-[0.8rem] font-semibold whitespace-nowrap",
                  selected ? "border-ink bg-white text-ink ring-1 ring-inset ring-ink" : "border-line bg-white text-ink",
                )}
              >
                <span className={cn("flex size-6 items-center justify-center", selected ? TONE[option.tone].tile : TONE[option.tone].soft)}>
                  <Icon size={15} stroke={2} aria-hidden />
                </span>
                {option.label}
                <span className="text-[0.7rem] font-normal text-soft">{counts.get(option.id)}</span>
              </button>
            );
          })}
        </div>
        <div>{grid}</div>
        {deleteDialog}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <div className="border-b border-line px-4 pb-3">{search}</div>
      <div className="flex min-h-0 flex-1">
        <nav className="w-[84px] shrink-0 overflow-y-auto border-r border-line bg-wash py-1" role="tablist" aria-label="가구 종류" aria-orientation="vertical">
          {filters.map((option) => {
            const Icon = option.icon;
            const selected = filter === option.id;
            const count = counts.get(option.id) ?? 0;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(option.id)}
                className={cn(
                  "relative flex w-full flex-col items-center gap-1 px-1 py-2.5 text-center text-[0.7rem] leading-tight transition-colors",
                  selected ? "bg-white font-bold text-ink" : "text-soft hover:bg-white/60 hover:text-ink",
                  count === 0 && !selected && "opacity-40",
                )}
              >
                {selected && <span className={cn("absolute inset-y-1.5 left-0 w-[3px]", TONE[option.tone].bar)} aria-hidden />}
                <span className={cn("flex size-8 items-center justify-center transition-colors", selected ? TONE[option.tone].tile : TONE[option.tone].soft)}>
                  <Icon size={18} stroke={selected ? 2.1 : 1.8} aria-hidden />
                </span>
                <span>{option.label}</span>
                <span className="text-[0.62rem] font-normal text-soft">{count}</span>
              </button>
            );
          })}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">{grid}</div>
      </div>
      {deleteDialog}
    </div>
  );
}

function DeleteButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label} 지우기`}
      title="지우기"
      className="absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center border border-line bg-white/90 text-soft opacity-100 hover:text-ink focus-visible:opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
    >
      <IconTrash size={13} stroke={2} aria-hidden />
    </button>
  );
}

/** 만드는 중이거나 실패한 내 가구 — 놓을 수 없다. */
function PendingCard({ item, onDelete }: { item: CustomFurniture; onDelete: () => void }) {
  const processing = item.status === "PROCESSING";
  return (
    <div className="group/card relative flex flex-col border border-line bg-white" aria-busy={processing}>
      <span className="relative flex aspect-square w-full flex-col items-center justify-center gap-1.5 bg-wash px-2 text-center text-[0.66rem] text-soft">
        {processing ? (
          <>
            <IconLoader2 size={22} stroke={2} aria-hidden className="animate-spin text-ink" />
            3D로 만드는 중…
          </>
        ) : (
          <>
            <IconAlertTriangle size={20} stroke={2} aria-hidden className="text-coral" />
            <span className="line-clamp-3">{item.failure_reason ?? "만들지 못했어요."}</span>
          </>
        )}
      </span>
      <span className="flex flex-1 flex-col gap-0.5 px-1.5 pb-1.5 pt-1">
        <span className="line-clamp-2 min-h-[2lh] text-[0.75rem] font-semibold leading-tight text-ink">{item.name}</span>
        <span className="text-[0.66rem] text-soft">{processing ? "2분쯤 걸려요" : "다시 만들어 주세요"}</span>
      </span>
      {!processing && <DeleteButton label={item.name} onClick={onDelete} />}
    </div>
  );
}

function FurnitureCard({ def, active, disabled, onPick, onDelete }: {
  def: FurnitureDef;
  active: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
  onDelete?: () => void;
}) {
  const privateThumbnail = def.custom ? def.thumbnail : undefined;
  const [preview, setPreview] = useState<{ path: string; url: string }>();
  useEffect(() => {
    if (!privateThumbnail) return;
    const controller = new AbortController();
    let url: string | undefined;
    apiClient.get<Blob>(privateThumbnail, { responseType: "blob", signal: controller.signal }).then(({ data }) => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(data);
      setPreview({ path: privateThumbnail, url });
    }).catch(() => undefined);
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [privateThumbnail]);
  const thumbnail = def.custom ? (preview?.path === privateThumbnail ? preview?.url : undefined) : def.thumbnail;

  return (
    <div className="group/card relative flex">
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPick(def.id)}
      aria-pressed={active}
      title={`${def.name} · ${def.width}×${def.depth}m`}
      className={cn(
        "group relative flex w-full flex-col border bg-white text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active ? "border-[var(--main-d)] ring-2 ring-[var(--main-d)]" : "border-line hover:border-[var(--main-d)]",
      )}
    >
      {/* 썸네일 칸은 늘 정사각형 — 이미지는 그 안에 맞춰 넣는다(세로로 긴 썸네일이 카드를 늘리지 않게) */}
      <span className="relative block aspect-square w-full overflow-hidden bg-wash">
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element -- CDN 또는 인증 후 생성한 blob URL
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            className="absolute inset-[7%] h-[86%] w-[86%] object-contain transition-transform group-hover:scale-105"
          />
        ) : (
          <IconShape size={28} stroke={1.4} aria-hidden className="absolute inset-0 m-auto text-soft" />
        )}
      </span>
      {def.mount && def.mount !== "floor" && (
        <span className="absolute right-1 top-1 bg-ink/80 px-1 py-px text-[0.6rem] font-semibold leading-none text-white">
          {def.mount === "wall" ? "벽" : "천장"}
        </span>
      )}
      <span className="flex flex-1 flex-col gap-0.5 px-1.5 pb-1.5 pt-1">
        <span className="line-clamp-2 min-h-[2lh] text-[0.75rem] font-semibold leading-tight text-ink">{def.name}</span>
        <span className="text-[0.66rem] text-soft">{def.width.toFixed(1)}×{def.depth.toFixed(1)}m</span>
      </span>
    </button>
    {onDelete && <DeleteButton label={def.name} onClick={onDelete} />}
    </div>
  );
}
