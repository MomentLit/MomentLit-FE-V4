"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconCamera, IconCube, IconHelp, IconRotate, IconRotateClockwise2, IconX } from "@tabler/icons-react";
import {
  createFurnitureFromFile,
  createFurnitureFromPhoto,
  MAX_FURNITURE_PHOTO_PER_DAY,
  type CustomFurniture,
  type CustomFurnitureMount,
} from "@/entities/room";
import { getErrorMessage } from "@/shared/api";
import { cn } from "@/shared/lib";
import { Modal } from "@/shared/ui/Modal";
import { FurniturePhotoTutorial, shouldAutoOpenFurniturePhotoTutorial } from "./FurniturePhotoTutorial";
import { ModelFilePreview, MAX_MODEL_BYTES, type ExportModel, type ModelDimensions } from "./ModelFilePreview";
import { MY_FURNITURE_QUERY_KEY } from "./useFurnitureLibrary";

type Tab = "photo" | "file";

const MOUNT_OPTIONS: readonly { id: CustomFurnitureMount; label: string }[] = [
  { id: "FLOOR", label: "바닥" },
  { id: "WALL", label: "벽" },
  { id: "CEILING", label: "천장" },
];

/** cm 입력 → m. 비었거나 숫자가 아니면 null. */
function cmToMeters(value: string): number | null {
  const n = Number(value);
  return value.trim() && Number.isFinite(n) && n > 0 ? n / 100 : null;
}

/**
 * 내 가구 추가 — 사진으로 만들기(서버가 2분쯤 걸려 3D로) / 3D 파일(GLB) 올리기(미리보기에서 세우고 크기 맞춤).
 * 만든 가구는 본인만 보고 쓴다.
 */
export function AddFurnitureDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (furniture: CustomFurniture) => void }) {
  const [tab, setTab] = useState<Tab>("photo");
  const [busy, setBusy] = useState(false);
  // 사진 찍는 법 — 처음 열 때 한 번 저절로. 모달이 겹치면 Esc가 둘 다 닫으므로 이 창 대신 보여 준다(사진 입력값은 photoDraft에 남는다).
  const [guideOpen, setGuideOpen] = useState(false);
  const photoDraft = usePhotoDraft();
  useEffect(() => {
    if (shouldAutoOpenFurniturePhotoTutorial()) queueMicrotask(() => setGuideOpen(true));
  }, []);
  if (guideOpen) return <FurniturePhotoTutorial onClose={() => setGuideOpen(false)} />;
  return (
    <Modal label="내 가구 추가" onClose={onClose} canClose={!busy} panelClassName="flex w-full max-w-[640px] flex-col gap-5 overflow-y-auto border border-line bg-white p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">내 가구 추가</h2>
          <p className="mt-1 text-sm text-soft">우리 집 가구를 3D로 만들어 방에 놓아 보세요. 만든 가구는 나만 볼 수 있어요.</p>
        </div>
        <button type="button" onClick={onClose} disabled={busy} aria-label="닫기" className="button button--outline button--sm button--icon">
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </div>
      <div className="tabs border-b border-line" role="tablist" aria-label="추가 방법">
        {([["photo", "사진으로 만들기", IconCamera], ["file", "3D 파일 올리기", IconCube]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            aria-current={tab === id ? "true" : undefined}
            disabled={busy}
            onClick={() => setTab(id)}
            className="tabs__item inline-flex items-center gap-1.5"
          >
            <Icon size={16} stroke={2} aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {tab === "photo"
        ? <PhotoForm busy={busy} setBusy={setBusy} onCreated={onCreated} onOpenGuide={() => setGuideOpen(true)} draft={photoDraft} />
        : <FileForm busy={busy} setBusy={setBusy} onCreated={onCreated} />}
    </Modal>
  );
}

interface FormProps {
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onCreated: (furniture: CustomFurniture) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-soft">{hint}</span>}
    </label>
  );
}

const inputClass = "h-10 w-full border border-line bg-white px-3 text-sm text-ink focus:border-ink focus:outline-none";

function NameAndMount({ name, setName, mount, setMount, disabled }: {
  name: string;
  setName: (name: string) => void;
  mount: CustomFurnitureMount;
  setMount: (mount: CustomFurnitureMount) => void;
  disabled: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
      <Field label="이름">
        <input value={name} onChange={(event) => setName(event.target.value)} maxLength={50} disabled={disabled} placeholder="예: 거실 소파" className={inputClass} />
      </Field>
      <Field label="놓는 곳">
        <div className="flex" role="radiogroup" aria-label="놓는 곳">
          {MOUNT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={mount === option.id}
              disabled={disabled}
              onClick={() => setMount(option.id)}
              className={cn("button button--sm h-10 -ml-px first:ml-0", mount === option.id ? "button--primary" : "button--outline")}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function PhotoPicker({ label, hint, file, onChange, disabled, required }: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled: boolean;
  required?: boolean;
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}{required ? "" : " (선택)"}</span>
      <label className={cn("relative flex aspect-[4/3] cursor-pointer items-center justify-center overflow-hidden border border-dashed border-line-2 bg-wash text-center text-xs text-soft hover:border-ink", disabled && "pointer-events-none opacity-60")}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element -- 고른 사진 미리보기(blob URL)
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <span className="flex flex-col items-center gap-1 px-3"><IconCamera size={22} stroke={1.6} aria-hidden />{hint}</span>
        )}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={disabled} onChange={(event) => onChange(event.target.files?.[0] ?? null)} />
      </label>
      {file && (
        <button type="button" onClick={() => onChange(null)} disabled={disabled} className="self-start text-xs text-soft underline">
          다른 사진 고르기
        </button>
      )}
    </div>
  );
}

/** 사진으로 만들기 입력값 — 촬영 가이드를 보는 동안 폼이 사라져도 남도록 대화상자가 들고 있는다. */
function usePhotoDraft() {
  const [name, setName] = useState("");
  const [mount, setMount] = useState<CustomFurnitureMount>("FLOOR");
  const [front, setFront] = useState<File | null>(null);
  const [side, setSide] = useState<File | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  return { name, setName, mount, setMount, front, setFront, side, setSide, heightCm, setHeightCm, widthCm, setWidthCm, depthCm, setDepthCm };
}

type PhotoDraft = ReturnType<typeof usePhotoDraft>;

function PhotoForm({ busy, setBusy, onCreated, onOpenGuide, draft }: FormProps & { onOpenGuide: () => void; draft: PhotoDraft }) {
  const queryClient = useQueryClient();
  const { name, setName, mount, setMount, front, setFront, side, setSide, heightCm, setHeightCm, widthCm, setWidthCm, depthCm, setDepthCm } = draft;
  const [error, setError] = useState<string | null>(null);

  const height = cmToMeters(heightCm);
  const ready = Boolean(name.trim() && front && height && height >= 0.05 && height <= 3.5);

  async function submit() {
    if (!ready || !front || !height) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createFurnitureFromPhoto({
        name: name.trim(),
        mount,
        height,
        width: cmToMeters(widthCm) ?? undefined,
        depth: cmToMeters(depthCm) ?? undefined,
        front,
        side,
      });
      await queryClient.invalidateQueries({ queryKey: MY_FURNITURE_QUERY_KEY });
      onCreated(created);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 border border-line bg-wash px-4 py-3 text-xs leading-relaxed text-soft">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-ink">찍기 전에 꼭 확인해 주세요</p>
          <button type="button" onClick={onOpenGuide} disabled={busy} className="button button--outline button--sm shrink-0">
            <IconHelp size={15} stroke={2} aria-hidden /> 촬영 가이드
          </button>
        </div>
        <ul className="list-disc pl-4">
          <li><b className="font-semibold text-ink">무채색 배경</b> — 흰색·회색처럼 무늬 없는 벽이나 바닥 앞에서 찍어요.</li>
          <li><b className="font-semibold text-ink">만들 가구 하나만</b> — 다른 가구·화분·사람이 같이 찍히면 그것까지 만들어져요.</li>
          <li>가구 중간 높이에서 2~3m 떨어져, 가구 전체가 화면에 들어오게 정면이나 살짝 대각선으로 찍어요.</li>
        </ul>
        <p>사진 한 장으로 뒷면을 짐작해 만들어서 뒷모습은 조금 다를 수 있어요. 하루 {MAX_FURNITURE_PHOTO_PER_DAY}번까지 만들 수 있어요.</p>
      </div>
      <NameAndMount name={name} setName={setName} mount={mount} setMount={setMount} disabled={busy} />
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoPicker label="정면 사진" hint="눌러서 정면 사진 고르기" file={front} onChange={setFront} disabled={busy} required />
        <PhotoPicker label="옆 사진" hint="옆에서 찍으면 깊이가 더 정확해요" file={side} onChange={setSide} disabled={busy} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="높이 (cm)" hint="줄자로 잰 값">
          <input inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} disabled={busy} placeholder="85" className={inputClass} />
        </Field>
        <Field label="폭 (cm, 선택)">
          <input inputMode="decimal" value={widthCm} onChange={(event) => setWidthCm(event.target.value)} disabled={busy} className={inputClass} />
        </Field>
        <Field label="깊이 (cm, 선택)">
          <input inputMode="decimal" value={depthCm} onChange={(event) => setDepthCm(event.target.value)} disabled={busy} className={inputClass} />
        </Field>
      </div>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        <p className="mr-auto text-xs text-soft">만들기에 2분쯤 걸려요. 그동안 다른 가구를 놓고 있어도 돼요.</p>
        <button type="button" onClick={submit} disabled={!ready || busy} className="button button--primary">
          {busy ? "보내는 중…" : "3D로 만들기"}
        </button>
      </div>
    </div>
  );
}

function FileForm({ busy, setBusy, onCreated }: FormProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [mount, setMount] = useState<CustomFurnitureMount>("FLOOR");
  const [file, setFile] = useState<File | null>(null);
  const [heightCm, setHeightCm] = useState("");
  const [uprightTurns, setUprightTurns] = useState(0);
  const [yawTurns, setYawTurns] = useState(0);
  const [dims, setDims] = useState<ModelDimensions | null>(null);
  const [error, setError] = useState<string | null>(null);
  const exportRef = useRef<ExportModel | null>(null);

  const height = cmToMeters(heightCm) ?? 1;
  const ready = Boolean(name.trim() && file && dims && cmToMeters(heightCm));

  function pickFile(next: File | null) {
    setError(null);
    setDims(null);
    if (next && !/\.glb$/i.test(next.name)) {
      setError("GLB(.glb) 파일만 올릴 수 있어요. 3D 스캔 앱에서 GLB로 내보내 주세요.");
      return;
    }
    if (next && next.size > MAX_MODEL_BYTES * 2) {
      setError("파일이 너무 커요(60MB 넘음).");
      return;
    }
    setFile(next);
    setUprightTurns(0);
    setYawTurns(0);
    if (next && !name) setName(next.name.replace(/\.glb$/i, "").slice(0, 50));
  }

  async function submit() {
    if (!ready || !exportRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const exported = await exportRef.current();
      const created = await createFurnitureFromFile({
        name: name.trim(),
        mount,
        width: exported.width,
        depth: exported.depth,
        height: exported.height,
        model: exported.glb,
        thumbnail: exported.thumbnail,
      });
      await queryClient.invalidateQueries({ queryKey: MY_FURNITURE_QUERY_KEY });
      onCreated(created);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-soft">
        3D 스캔 앱(Polycam·Scaniverse 등)이나 3D 프로그램에서 내보낸 <b className="text-ink">GLB</b> 파일을 올려 주세요.
        미리보기에서 바로 세우고, 앞(노란 화살표)을 맞추고, 높이를 넣으면 그 크기로 방에 놓여요.
      </p>
      {!file ? (
        <label className="flex aspect-[16/9] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-line-2 bg-wash text-sm text-soft hover:border-ink">
          <IconCube size={28} stroke={1.5} aria-hidden />
          눌러서 GLB 파일 고르기
          <input type="file" accept=".glb,model/gltf-binary" className="sr-only" onChange={(event) => pickFile(event.target.files?.[0] ?? null)} />
        </label>
      ) : (
        <>
          <ModelFilePreview
            file={file}
            uprightTurns={uprightTurns}
            yawTurns={yawTurns}
            height={height}
            onDimensions={setDims}
            onError={(message) => {
              setError(message);
              setFile(null);
            }}
            exportRef={exportRef}
            className="aspect-[16/10] w-full"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setUprightTurns((t) => (t + 1) % 4)} disabled={busy} className="button button--outline button--sm">
              <IconRotate size={15} stroke={2} aria-hidden />
              눕힌 모델 세우기
            </button>
            <button type="button" onClick={() => setYawTurns((t) => (t + 1) % 4)} disabled={busy} className="button button--outline button--sm">
              <IconRotateClockwise2 size={15} stroke={2} aria-hidden />
              앞 돌리기 90°
            </button>
            <button type="button" onClick={() => pickFile(null)} disabled={busy} className="ml-auto text-xs text-soft underline">
              다른 파일 고르기
            </button>
          </div>
        </>
      )}
      <NameAndMount name={name} setName={setName} mount={mount} setMount={setMount} disabled={busy} />
      <div className="grid grid-cols-[1fr_2fr] items-end gap-3">
        <Field label="높이 (cm)" hint="실제 가구 높이">
          <input inputMode="decimal" value={heightCm} onChange={(event) => setHeightCm(event.target.value)} disabled={busy} placeholder="85" className={inputClass} />
        </Field>
        <p className="pb-6 text-sm text-soft">
          {dims && cmToMeters(heightCm)
            ? <>방에 놓일 크기 <b className="text-ink">{dims.width.toFixed(2)} × {dims.depth.toFixed(2)} × {dims.height.toFixed(2)}m</b></>
            : "높이를 넣으면 폭·깊이는 비율대로 맞춰져요."}
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-coral">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={submit} disabled={!ready || busy} className="button button--primary">
          {busy ? "올리는 중…" : "내 가구로 올리기"}
        </button>
      </div>
    </div>
  );
}
