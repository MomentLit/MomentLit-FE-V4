"use client";

import { useState, type FormEvent } from "react";
import { IconDeviceFloppy, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { MAX_FURNITURE_LAYOUTS, type FurnitureLayout } from "@/entities/room";
import { cn } from "@/shared/lib";
import { fieldInputClass } from "@/widgets/registration-form/FormField";
import type { useFurnitureLayouts } from "./useFurnitureLayout";

type Layouts = ReturnType<typeof useFurnitureLayouts>;

/** 저장 안 된 변경이 있을 때 한 번 더 묻는 동작. */
type Pending = { kind: "load"; layout: FurnitureLayout } | { kind: "new" } | { kind: "delete"; layout: FurnitureLayout };

const NAME_MAX = 50;

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 내 배치 — 이름 붙여 여러 개 저장하고, 불러와서 고치고, 덮어쓰거나 지운다. */
export function LayoutsPanel({ layouts }: { layouts: Layouts }) {
  const [naming, setNaming] = useState<{ mode: "new" } | { mode: "rename"; layout: FurnitureLayout } | null>(null);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);

  if (!layouts.isAuthenticated) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-soft">
          로그인하면 방마다 배치에 이름을 붙여 {MAX_FURNITURE_LAYOUTS}개까지 저장하고 언제든 다시 불러올 수 있어요.
          지금 놓은 가구는 이 브라우저에 임시로 남아 있어요.
        </p>
        <button type="button" onClick={layouts.openLogin} className="button button--primary self-start">
          로그인하고 저장하기
        </button>
      </div>
    );
  }

  const hasUnsaved = layouts.dirty && layouts.items.length > 0;

  function startNaming(mode: "new" | FurnitureLayout) {
    setPending(null);
    if (mode === "new") {
      setNaming({ mode: "new" });
      setName(`배치 ${layouts.layouts.length + 1}`);
    } else {
      setNaming({ mode: "rename", layout: mode });
      setName(mode.name);
    }
  }

  async function submitName(event: FormEvent) {
    event.preventDefault();
    if (!naming || !name.trim()) return;
    const result = naming.mode === "new"
      ? await layouts.saveAsNew(name)
      : await layouts.rename(naming.layout, name);
    if (result) setNaming(null);
  }

  function requestLoad(layout: FurnitureLayout) {
    if (hasUnsaved) setPending({ kind: "load", layout });
    else layouts.load(layout);
  }

  function requestNew() {
    if (hasUnsaved) setPending({ kind: "new" });
    else layouts.startNew();
  }

  async function confirmPending() {
    if (!pending) return;
    if (pending.kind === "load") layouts.load(pending.layout);
    else if (pending.kind === "new") layouts.startNew();
    else await layouts.remove(pending.layout);
    setPending(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink">
        {layouts.active ? (
          <>
            <span className="font-semibold">‘{layouts.active.name}’</span> 고치는 중
          </>
        ) : (
          <span className="font-semibold">새 배치</span>
        )}
        {layouts.dirty && <span className="text-soft"> · 저장 안 됨</span>}
      </p>

      <div className="flex flex-wrap gap-2">
        {layouts.active && layouts.dirty && (
          <button type="button" onClick={() => void layouts.overwrite()} disabled={layouts.busy} className="button button--primary">
            <IconDeviceFloppy size={18} stroke={2} aria-hidden />
            덮어쓰기
          </button>
        )}
        <button
          type="button"
          onClick={() => startNaming("new")}
          disabled={layouts.busy || layouts.limitReached}
          className={cn("button", layouts.active && layouts.dirty ? "button--outline" : "button--primary")}
        >
          <IconDeviceFloppy size={18} stroke={2} aria-hidden />
          새 배치로 저장
        </button>
        <button type="button" onClick={requestNew} disabled={layouts.busy} className="button button--outline">
          <IconPlus size={18} stroke={2} aria-hidden />
          빈 방에서 시작
        </button>
      </div>

      {layouts.limitReached && (
        <p className="text-xs text-soft">배치는 방마다 {MAX_FURNITURE_LAYOUTS}개까지 저장할 수 있어요. 안 쓰는 배치를 지우거나 덮어써 주세요.</p>
      )}

      {naming && (
        <form onSubmit={submitName} className="flex flex-col gap-2 border border-line p-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-ink">
            {naming.mode === "new" ? "새 배치 이름" : "배치 이름 바꾸기"}
            <input
              autoFocus
              value={name}
              maxLength={NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              className={fieldInputClass}
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={layouts.busy || !name.trim()} className="button button--primary">
              {layouts.busy ? "저장 중…" : "저장"}
            </button>
            <button type="button" onClick={() => setNaming(null)} disabled={layouts.busy} className="button button--outline">
              취소
            </button>
          </div>
        </form>
      )}

      {pending && (
        <div role="alert" className="flex flex-col gap-2 border-l-4 border-coral bg-wash p-3 text-sm text-ink">
          {pending.kind === "delete"
            ? `‘${pending.layout.name}’ 배치를 지울까요? 되돌릴 수 없어요.`
            : "지금 배치를 저장하지 않았어요. 바꾸면 저장 안 된 가구 배치가 사라져요."}
          <div className="flex gap-2">
            <button type="button" onClick={() => void confirmPending()} disabled={layouts.busy} className="button button--danger">
              {pending.kind === "delete" ? "지우기" : pending.kind === "load" ? `‘${pending.layout.name}’ 불러오기` : "빈 방에서 시작"}
            </button>
            <button type="button" onClick={() => setPending(null)} className="button button--outline">취소</button>
          </div>
        </div>
      )}

      {layouts.error && <p className="text-sm text-coral">{layouts.error}</p>}

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-ink">저장한 배치</span>
        <span className="text-xs text-soft">{layouts.layouts.length}/{MAX_FURNITURE_LAYOUTS}</span>
      </div>
      {layouts.layoutsLoading ? (
        <p className="text-sm text-soft">불러오는 중…</p>
      ) : layouts.layouts.length === 0 ? (
        <p className="text-sm text-soft">아직 저장한 배치가 없어요.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line border border-line">
          {layouts.layouts.map((layout) => {
            const isActive = layout.layout_id === layouts.active?.layout_id;
            return (
              <li key={layout.layout_id} className={cn("flex items-center gap-2 p-2.5", isActive && "bg-wash")}>
                <button
                  type="button"
                  onClick={() => requestLoad(layout)}
                  disabled={layouts.busy}
                  className="min-w-0 flex-1 text-left"
                  aria-current={isActive || undefined}
                >
                  <span className="block truncate text-sm font-semibold text-ink">{layout.name}</span>
                  <span className="block text-xs text-soft">
                    가구 {layout.items.length}개 · {formatUpdatedAt(layout.updated_at)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => startNaming(layout)}
                  disabled={layouts.busy}
                  aria-label={`${layout.name} 이름 바꾸기`}
                  className="button button--outline min-h-9 px-2.5 py-1.5"
                >
                  <IconPencil size={16} stroke={2} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setPending({ kind: "delete", layout })}
                  disabled={layouts.busy}
                  aria-label={`${layout.name} 지우기`}
                  className="button button--outline min-h-9 px-2.5 py-1.5"
                >
                  <IconTrash size={16} stroke={2} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
