"use client";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { IconArrowLeft, IconArrowRight, IconCheck, IconX } from "@tabler/icons-react";
import { Modal } from "@/shared/ui/Modal";
import { cn } from "@/shared/lib";

/** 도면 편집기의 색과 같게 — 바깥벽 노랑, 안쪽 벽 보라, 고른 것 파랑. */
const TAPE = "var(--yellow-600)";
const INNER = "#9a7cf2";
const SELECT = "var(--main-d)";
/** 한 장면이 한 번 도는 시간(초). 모든 그림 요소가 같은 시간축을 쓴다. */
const LOOP = 6;
/** 다 그린 뒤 잠깐 멈춰 보여 주고 사라지는 구간 — 매 장면 끝 8%. */
const HOLD_END = 0.92;

const SEEN_KEY = "momentlit.planTutorialSeen";

/** 처음 들어온 사람에게만 자동으로 띄울지 — 브라우저 저장소가 막혀 있으면 띄우지 않는다. */
export function shouldAutoOpenPlanTutorial() {
  try {
    return window.localStorage.getItem(SEEN_KEY) === null;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // 저장소가 막혀 있으면 다음에 또 볼 뿐이다
  }
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** 움직임 줄이기를 켰으면 그림을 다 그린 상태로 멈춰 보여 준다. */
function useReducedMotion() {
  return useSyncExternalStore(subscribeReducedMotion, () => window.matchMedia(REDUCED_MOTION).matches, () => false);
}

// ---------- 그림 조각 — SMIL로 한 시간축 위에서 차례로 나타난다(GIF처럼 반복) ----------

/** `from`~`to`(0~1) 사이에 나타나 장면 끝까지 남는 값 변화. */
function appear(from: number, to: number, hidden: string, shown: string) {
  return {
    values: `${hidden};${hidden};${shown};${shown};${hidden}`,
    keyTimes: `0;${from};${to};${HOLD_END};1`,
  };
}

function Motion({ reduced, attribute, from, to, hidden, shown }: {
  reduced: boolean;
  attribute: string;
  from: number;
  to: number;
  hidden: string;
  shown: string;
}) {
  if (reduced) return null;
  return <animate attributeName={attribute} dur={`${LOOP}s`} repeatCount="indefinite" {...appear(from, to, hidden, shown)} />;
}

/** 그려지는 벽 — `from`~`to` 동안 a에서 b로 선이 뻗는다. */
function Wall({ a, b, from, to, reduced, color = TAPE, dashed = false }: {
  a: [number, number];
  b: [number, number];
  from: number;
  to: number;
  reduced: boolean;
  color?: string;
  dashed?: boolean;
}) {
  return (
    <path
      d={`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`}
      pathLength={1}
      stroke={color}
      strokeWidth={4}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={dashed ? undefined : 1}
      strokeDashoffset={reduced || dashed ? 0 : 1}
    >
      {!dashed && <Motion reduced={reduced} attribute="stroke-dashoffset" from={from} to={to} hidden="1" shown="0" />}
    </path>
  );
}

/** 찍는 점 — 나타날 때 누른 자리에 물결이 한 번 퍼진다. */
function Dot({ at, time, reduced, ring = false }: { at: [number, number]; time: number; reduced: boolean; ring?: boolean }) {
  return (
    <g>
      {!reduced && (
        <circle cx={at[0]} cy={at[1]} r={4} fill="none" stroke="var(--ink)" strokeWidth={1.5} opacity={0}>
          <animate attributeName="r" dur={`${LOOP}s`} repeatCount="indefinite" values="4;4;14;14" keyTimes={`0;${time};${Math.min(time + 0.08, 0.99)};1`} />
          <animate attributeName="opacity" dur={`${LOOP}s`} repeatCount="indefinite" values="0;0;0.7;0;0" keyTimes={`0;${time};${Math.min(time + 0.01, 0.98)};${Math.min(time + 0.08, 0.99)};1`} />
        </circle>
      )}
      <circle cx={at[0]} cy={at[1]} r={ring ? 7 : 5} fill="white" stroke="var(--ink)" strokeWidth={2} opacity={reduced ? 1 : 0}>
        <Motion reduced={reduced} attribute="opacity" from={time} to={time + 0.01} hidden="0" shown="1" />
      </circle>
    </g>
  );
}

/** 밑에 깔린 도면 이미지 흉내 — 회색 두꺼운 벽, 아래쪽 벽에 문(틈과 문 열림 호). */
function PlanSketch({ door = true }: { door?: boolean }) {
  return (
    <g stroke="var(--line-2)" strokeWidth={7} strokeLinecap="square" fill="none">
      <path d="M40 30 H200 V120" />
      <path d={door ? "M200 120 H130 M90 120 H40 V30" : "M200 120 H40 V30"} />
      {door && <path d="M90 120 A40 40 0 0 1 130 80 M130 120 V80" strokeWidth={1.5} />}
    </g>
  );
}

const A: [number, number] = [40, 30];
const B: [number, number] = [200, 30];
const C: [number, number] = [200, 120];
const D: [number, number] = [40, 120];

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 240 150" role="img" aria-label={label} className="h-full w-full">
      {children}
    </svg>
  );
}

function StepCorners({ reduced }: { reduced: boolean }) {
  return (
    <Frame label="벽 도구로 방 모서리를 차례로 누르면 점마다 벽이 이어지는 그림">
      <PlanSketch />
      <Wall a={A} b={B} from={0.18} to={0.32} reduced={reduced} />
      <Wall a={B} b={C} from={0.4} to={0.52} reduced={reduced} />
      <Wall a={C} b={D} from={0.6} to={0.76} reduced={reduced} />
      <Dot at={A} time={0.08} reduced={reduced} />
      <Dot at={B} time={0.32} reduced={reduced} />
      <Dot at={C} time={0.52} reduced={reduced} />
      <Dot at={D} time={0.76} reduced={reduced} />
    </Frame>
  );
}

function StepDoor({ reduced, good }: { reduced: boolean; good: boolean }) {
  const doorLeft: [number, number] = [90, 120];
  const doorRight: [number, number] = [130, 120];
  return (
    <Frame label={good ? "문 자리도 벽처럼 지나가며 이어 그린 그림" : "문 앞에서 멈춰 바깥벽이 끊긴 그림"}>
      <PlanSketch />
      <Wall a={A} b={B} from={0.05} to={0.15} reduced={reduced} />
      <Wall a={B} b={C} from={0.18} to={0.26} reduced={reduced} />
      {good ? (
        <Wall a={C} b={D} from={0.32} to={0.6} reduced={reduced} />
      ) : (
        <>
          <Wall a={C} b={doorRight} from={0.32} to={0.44} reduced={reduced} />
          <Wall a={doorLeft} b={D} from={0.56} to={0.66} reduced={reduced} color="var(--coral)" />
        </>
      )}
      <Dot at={A} time={0.02} reduced={reduced} />
      <Dot at={B} time={0.15} reduced={reduced} />
      <Dot at={C} time={0.26} reduced={reduced} />
      {good ? <Dot at={D} time={0.6} reduced={reduced} /> : (
        <>
          <Dot at={doorRight} time={0.44} reduced={reduced} />
          <Dot at={doorLeft} time={0.56} reduced={reduced} />
          <Dot at={D} time={0.66} reduced={reduced} />
        </>
      )}
    </Frame>
  );
}

function StepClose({ reduced }: { reduced: boolean }) {
  return (
    <Frame label="마지막 점에서 첫 점을 다시 누르면 바깥벽이 닫히고 바닥이 생기는 그림">
      <PlanSketch />
      <path d="M40 30 H200 V120 H40 Z" fill={TAPE} fillOpacity={reduced ? 0.18 : 0} stroke="none">
        <Motion reduced={reduced} attribute="fill-opacity" from={0.6} to={0.7} hidden="0" shown="0.18" />
      </path>
      {/* 이미 그린 세 벽 — 마지막 벽만 그려진다 */}
      <path d="M40 30 H200 V120 H40" fill="none" stroke={TAPE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <Wall a={D} b={A} from={0.3} to={0.55} reduced={reduced} />
      {/* 첫 점을 누르라는 점선 고리 — 편집기에서도 첫 점에 같은 고리가 보인다 */}
      <circle cx={A[0]} cy={A[1]} r={12} fill="none" stroke={TAPE} strokeWidth={2} strokeDasharray="4 3" />
      {[A, B, C, D].map((p) => <circle key={p.join()} cx={p[0]} cy={p[1]} r={5} fill="white" stroke="var(--ink)" strokeWidth={2} />)}
      <Dot at={A} time={0.55} reduced={reduced} ring />
      <text x={120} y={80} textAnchor="middle" fontSize={13} fontWeight={700} fill="var(--ink)" opacity={reduced ? 1 : 0}>
        닫혔어요 · 면적이 나와요
        <Motion reduced={reduced} attribute="opacity" from={0.62} to={0.7} hidden="0" shown="1" />
      </text>
    </Frame>
  );
}

function StepInner({ reduced }: { reduced: boolean }) {
  const top: [number, number] = [130, 30];
  const mid: [number, number] = [130, 80];
  const right: [number, number] = [200, 80];
  return (
    <Frame label="바깥벽을 닫은 뒤 바깥벽 위의 점에서 안쪽 벽을 그리는 그림">
      <PlanSketch />
      <path d="M40 30 H200 V120 H40 Z" fill={TAPE} fillOpacity={0.18} stroke={TAPE} strokeWidth={4} strokeLinejoin="round" />
      {[A, B, C, D].map((p) => <circle key={p.join()} cx={p[0]} cy={p[1]} r={5} fill="white" stroke="var(--ink)" strokeWidth={2} />)}
      <Wall a={top} b={mid} from={0.2} to={0.42} reduced={reduced} color={INNER} />
      <Wall a={mid} b={right} from={0.5} to={0.7} reduced={reduced} color={INNER} />
      <Dot at={top} time={0.1} reduced={reduced} />
      <Dot at={mid} time={0.42} reduced={reduced} />
      <Dot at={right} time={0.7} reduced={reduced} />
    </Frame>
  );
}

function StepEdit() {
  return (
    <Frame label="벽을 골라 길이를 넣고, 점은 끌어서 옮기는 그림">
      <PlanSketch door={false} />
      <path d="M40 30 H200 V120 H40 Z" fill={TAPE} fillOpacity={0.18} stroke={TAPE} strokeWidth={4} strokeLinejoin="round" />
      <path d="M40 30 H200" stroke={SELECT} strokeWidth={6} strokeLinecap="round" />
      {[A, B, C, D].map((p) => <circle key={p.join()} cx={p[0]} cy={p[1]} r={5} fill="white" stroke="var(--ink)" strokeWidth={2} />)}
      <g transform="translate(78 44)">
        <rect width={84} height={24} fill="white" stroke={SELECT} strokeWidth={1.5} />
        <text x={42} y={16} textAnchor="middle" fontSize={11} fontWeight={700} fill={SELECT}>3,200 mm</text>
      </g>
    </Frame>
  );
}

interface Step {
  title: string;
  body: ReactNode;
  image: (reduced: boolean) => ReactNode;
}

const STEPS: Step[] = [
  {
    title: "‘벽’ 도구로 모서리를 차례로 눌러요",
    body: "왼쪽 막대에서 ‘벽’을 고르고 방 모서리를 한 바퀴 돌며 눌러요. 누를 때마다 앞 점과 벽으로 이어져요. 잘못 찍었으면 ‘되돌리기’를 눌러요.",
    image: (reduced) => <StepCorners reduced={reduced} />,
  },
  {
    title: "입구·문 자리도 벽처럼 이어 그려요",
    body: (
      <>
        바깥벽은 방을 한 바퀴 도는 <b className="font-semibold text-ink">하나의 선</b>이에요. 문 앞에서 멈추면 선이 끊겨서 방이 닫히지 않아요. 문 위로 그냥 지나가며 그려 주세요.
      </>
    ),
    image: (reduced) => (
      <div className="grid h-full grid-cols-2 gap-2">
        <figure className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1"><StepDoor reduced={reduced} good={false} /></div>
          <figcaption className="flex items-center justify-center gap-1 text-xs font-semibold text-coral">
            <IconX size={14} stroke={2.5} aria-hidden /> 문 앞에서 멈추기
          </figcaption>
        </figure>
        <figure className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1"><StepDoor reduced={reduced} good /></div>
          <figcaption className="flex items-center justify-center gap-1 text-xs font-semibold text-ink">
            <IconCheck size={14} stroke={2.5} aria-hidden /> 문 위로 이어 그리기
          </figcaption>
        </figure>
      </div>
    ),
  },
  {
    title: "첫 점을 다시 누르면 닫혀요",
    body: "마지막 모서리까지 찍었으면 첫 점(점선 고리)을 눌러요. 바깥벽이 닫히면 바닥이 생기고 면적이 나와요.",
    image: (reduced) => <StepClose reduced={reduced} />,
  },
  {
    title: "닫은 뒤에 안쪽 벽(칸막이)을 그려요",
    body: "바깥벽을 닫아야 안쪽 벽을 그릴 수 있어요. 닫은 뒤 ‘벽’ 도구로 누르면 안쪽 벽이 되고, 바깥벽 위의 점에서 시작하면 그 점에 붙어요. Esc로 선을 끊어요.",
    image: (reduced) => <StepInner reduced={reduced} />,
  },
  {
    title: "길이를 고치고, 필요한 것만 지워요",
    body: (
      <>
        벽을 누르고 숫자를 치면 길이(mm)가 바뀌어요. 점은 끌어서 옮겨요. 하나만 지우려면 고른 뒤 <b className="font-semibold text-ink">‘선택 삭제’</b>(Delete)를,
        처음부터 다시 하려면 ‘전체 삭제’를 눌러요.
      </>
    ),
    image: () => <StepEdit />,
  },
];

/** 도면 그리는 법 — 장면마다 움직이는 그림과 짧은 설명을 넘겨 본다. */
export function PlanTutorial({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const reduced = useReducedMotion();
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  function close() {
    markSeen();
    onClose();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") setIndex((i) => Math.min(i + 1, STEPS.length - 1));
      else if (event.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <Modal
      label="도면 그리는 법"
      onClose={close}
      panelClassName="flex w-full max-w-[520px] flex-col gap-4 border border-line bg-white p-5 sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.18em] text-soft">
          도면 그리는 법 · {index + 1}/{STEPS.length}
        </span>
        <button type="button" onClick={close} aria-label="닫기" className="button button--outline button--sm button--icon">
          <IconX size={16} stroke={2} aria-hidden />
        </button>
      </div>

      {/* key로 장면을 새로 그려 — 넘길 때마다 그림이 처음부터 돈다 */}
      <div key={index} className="aspect-[8/5] w-full border border-line bg-wash p-2">
        {step.image(reduced)}
      </div>

      <div className="flex min-h-[104px] flex-col gap-1.5" aria-live="polite">
        <h2 className="text-base font-bold text-ink">{step.title}</h2>
        <p className="text-sm leading-relaxed text-soft">{step.body}</p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="장면">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}. ${s.title}`}
              onClick={() => setIndex(i)}
              className={cn("h-2 transition-all", i === index ? "w-5 bg-ink" : "w-2 bg-line-2 hover:bg-soft")}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {index > 0 && (
            <button type="button" onClick={() => setIndex(index - 1)} className="button button--outline button--sm">
              <IconArrowLeft size={15} stroke={2} aria-hidden />
              이전
            </button>
          )}
          {last ? (
            <button type="button" onClick={close} className="button button--primary button--sm">
              시작하기
            </button>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)} className="button button--primary button--sm">
              다음
              <IconArrowRight size={15} stroke={2} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
