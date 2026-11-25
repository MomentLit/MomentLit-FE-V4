"use client";

import { RoomTutorial, shouldAutoOpenRoomTutorial, type RoomTutorialStep } from "./RoomTutorial";

const SEEN_KEY = "momentlit.furniturePhotoTutorialSeen";
const MARK = "var(--yellow-600)";
const ACTIVE = "var(--main-d)";
const BAD = "var(--coral)";

export function shouldAutoOpenFurniturePhotoTutorial() {
  return shouldAutoOpenRoomTutorial(SEEN_KEY);
}

/** 정면에서 본 의자 — (x, y)가 좌석 왼쪽 위, s가 배율. */
function Chair({ x, y, s = 1, color = "#7d8a96" }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="6" y="-46" width="48" height="44" rx="4" fill={color} />
      <rect x="0" y="0" width="60" height="12" rx="3" fill={color} />
      <path d="M4 12V44M56 12V44" stroke="#3d434a" strokeWidth="4" strokeLinecap="round" />
    </g>
  );
}

function Check({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="13" fill="white" stroke={ACTIVE} strokeWidth="2" />
      <path d="M-6 0L-2 4L6 -4" fill="none" stroke={ACTIVE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function Cross({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="13" fill="white" stroke={BAD} strokeWidth="2" />
      <path d="M-5 -5L5 5M5 -5L-5 5" stroke={BAD} strokeWidth="3" strokeLinecap="round" />
    </g>
  );
}

/** 1. 무채색 배경 — 무늬·물건이 많은 배경(X) vs 단색 벽(O). */
function BackgroundIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <rect x="12" y="20" width="140" height="160" fill="#f3e3c8" />
      {[0, 1, 2, 3].map((i) => <path key={i} d={`M${12 + i * 32} 20L${44 + i * 32} 180`} stroke="#e0a87a" strokeWidth="9" opacity="0.7" />)}
      <rect x="22" y="40" width="26" height="34" fill="#8fb3a2" />
      <circle cx="128" cy="56" r="14" fill="#e98b7b" />
      <Chair x={52} y={118} />
      <Cross x={140} y={32} />

      <rect x="168" y="20" width="140" height="160" fill="#e4e4e2" />
      <path d="M168 150H308" stroke="#cfcfcc" strokeWidth="2" />
      <Chair x={208} y={118} />
      <Check x={296} y={32} />
    </svg>
  );
}

/** 2. 만들 가구 하나만 — 다른 가구가 같이 찍히면(X), 한 개만 화면에(O). */
function SingleIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <rect x="12" y="20" width="140" height="160" fill="#e4e4e2" />
      <Chair x={22} y={118} s={0.85} />
      <rect x="84" y="96" width="58" height="10" rx="2" fill="#9c7350" />
      <path d="M90 106V150M136 106V150" stroke="#6d4f36" strokeWidth="4" strokeLinecap="round" />
      <circle cx="110" cy="84" r="10" fill="#4f7a4a" />
      <Cross x={140} y={32} />

      <rect x="168" y="20" width="140" height="160" fill="#e4e4e2" />
      <Chair x={208} y={118} />
      <path d="M196 60V52H204M272 52H280V60M196 156V164H204M272 164H280V156" fill="none" stroke={MARK} strokeWidth="3" />
      <Check x={296} y={32} />
    </svg>
  );
}

/** 3. 가구 전체가 보이게 — 가구 중간 높이에서 2~3m 떨어져 정면(또는 살짝 대각선). */
function DistanceIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <rect x="0" y="0" width="320" height="200" fill="#e4e4e2" />
      <path d="M0 168H320" stroke="#cfcfcc" strokeWidth="2" />
      <Chair x={210} y={124} s={1.05} />
      <path d="M118 112L206 112" stroke={ACTIVE} strokeWidth="2" strokeDasharray="5 4" />
      <path d="M70 182H226M70 176V188M226 176V188" stroke={ACTIVE} strokeWidth="2" />
      <rect x="120" y="170" width="56" height="22" rx="3" fill="white" stroke={ACTIVE} />
      <text x="148" y="186" fill={ACTIVE} textAnchor="middle" fontSize="13" fontWeight="700">2~3m</text>
      <g transform="translate(70 100)">
        <rect x="-22" y="0" width="44" height="26" rx="4" fill="#3d434a" />
        <rect x="-8" y="-6" width="16" height="8" rx="2" fill="#3d434a" />
        <circle cx="0" cy="13" r="8" fill="white" />
        <circle cx="0" cy="13" r="4.5" fill={ACTIVE} />
        <path d="M0 26V68" stroke="#3d434a" strokeWidth="3" />
        <path d="M-14 68L0 52L14 68" fill="none" stroke="#3d434a" strokeWidth="3" />
      </g>
      <path d="M196 72V52H216M262 52H282V72M196 152V172M282 152V172" fill="none" stroke={MARK} strokeWidth="3" />
    </svg>
  );
}

/** 4. 높이를 재고 기다리기 — 줄자로 잰 높이(cm) + 2분쯤. */
function MeasureIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <rect x="0" y="0" width="320" height="200" fill="#e4e4e2" />
      <path d="M0 168H320" stroke="#cfcfcc" strokeWidth="2" />
      <Chair x={60} y={124} s={1.05} />
      <path d="M150 74V168" stroke={MARK} strokeWidth="6" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <path key={i} d={`M147 ${78 + i * 10}H153`} stroke="#3d434a" strokeWidth="1.5" />)}
      <path d="M128 74H160" stroke={ACTIVE} strokeWidth="2" />
      <rect x="160" y="62" width="58" height="24" rx="3" fill="white" stroke={ACTIVE} />
      <text x="189" y="79" fill={ACTIVE} textAnchor="middle" fontSize="14" fontWeight="700">85cm</text>
      <g transform="translate(262 112)">
        <circle r="32" fill="white" stroke={ACTIVE} strokeWidth="3" />
        <path d="M0 -18V0L12 8" fill="none" stroke={ACTIVE} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <text y="52" fill={ACTIVE} textAnchor="middle" fontSize="13" fontWeight="700">약 2분</text>
      </g>
    </svg>
  );
}

const STEPS = [
  {
    title: "무채색 배경에서 찍어요",
    body: "흰색·회색처럼 무늬 없는 벽이나 바닥 앞에서 찍어 주세요. 배경에 무늬나 다른 물건이 많으면 가구만 잘라 내지 못해 모양이 망가져요.",
    image: () => <BackgroundIllustration />,
  },
  {
    title: "만들 가구 하나만 화면에 담아요",
    body: "다른 가구·화분·사람이 같이 찍히면 그것까지 한 덩어리로 만들어져요. 주변 물건은 치우거나, 만들 가구만 꽉 차게 찍어 주세요.",
    image: () => <SingleIllustration />,
  },
  {
    title: "가구 전체가 보이게 찍어요",
    body: "가구 중간 높이에서 2~3m 떨어져 정면이나 살짝 대각선으로 찍어요. 다리·등받이 끝이 화면 밖으로 잘리지 않게 해 주세요.",
    image: () => <DistanceIllustration />,
  },
  {
    title: "높이를 재고 기다려요",
    body: "줄자로 잰 높이(cm)를 넣으면 실제 크기로 만들어요. 만드는 데 2분쯤 걸리고, 그동안 다른 가구를 놓고 있어도 돼요.",
    image: () => <MeasureIllustration />,
  },
] satisfies [RoomTutorialStep, ...RoomTutorialStep[]];

export function FurniturePhotoTutorial({ onClose }: { onClose: () => void }) {
  return <RoomTutorial label="가구 사진 찍는 법" seenKey={SEEN_KEY} steps={STEPS} onClose={onClose} />;
}
