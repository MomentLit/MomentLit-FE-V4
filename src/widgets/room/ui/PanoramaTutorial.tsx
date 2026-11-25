"use client";

import { RoomTutorial, shouldAutoOpenRoomTutorial, type RoomTutorialStep } from "./RoomTutorial";

const SEEN_KEY = "momentlit.panoramaTutorialSeen";
const MARK = "var(--yellow-600)";
const ACTIVE = "var(--main-d)";

export function shouldAutoOpenPanoramaTutorial() {
  return shouldAutoOpenRoomTutorial(SEEN_KEY);
}

function RoomIllustration({ mode }: { mode: "floor" | "ceiling" | "preview" }) {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <path d="M20 24H300V176H20Z" className="fill-white stroke-line" />
      <path d="M20 24H300L250 55H70Z" fill="#f0ebe2" />
      <path d="M20 24L70 55V134L20 176Z" fill="#d9e2e0" />
      <path d="M70 55H250V134H70Z" fill="#ebe6db" />
      <path d="M300 24L250 55V134L300 176Z" fill="#d9e2e0" />
      <path d="M20 176L70 134H250L300 176Z" fill="#ddd0bc" />
      <path d="M20 176L70 134H250L300 176M20 24L70 55H250L300 24" fill="none" stroke="#999387" strokeWidth="2" />
      {mode === "floor" && (
        <>
          <path d="M20 176L70 134H250L300 176" fill="none" stroke={MARK} strokeWidth="3" />
          <circle cx="70" cy="134" r="7" fill={MARK} />
          <circle cx="250" cy="134" r="7" fill={MARK} />
        </>
      )}
      {mode === "ceiling" && (
        <>
          <path d="M250 134V55" stroke={ACTIVE} strokeWidth="2" strokeDasharray="5 4" />
          <circle cx="250" cy="134" r="6" fill={MARK} />
          <circle cx="250" cy="55" r="13" fill="white" stroke={ACTIVE} strokeWidth="2" />
          <circle cx="250" cy="55" r="6" fill={ACTIVE} />
        </>
      )}
      {mode === "preview" && (
        <>
          <path d="M130 96H147M173 96H190M160 66V83M160 109V126" fill="none" stroke={ACTIVE} strokeWidth="2" strokeLinecap="round" />
          <path d="M242 151L251 160L269 142" fill="none" stroke={ACTIVE} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

function ScaleIllustration() {
  return (
    <svg viewBox="0 0 320 200" className="h-full w-full" aria-hidden="true">
      <path d="M55 58H265V158H55Z" className="fill-white" stroke={MARK} strokeWidth="3" />
      <path d="M55 58H265" stroke={ACTIVE} strokeWidth="5" />
      <path d="M55 45V30M265 45V30M55 37H265" stroke={ACTIVE} strokeWidth="1.5" />
      <rect x="122" y="22" width="76" height="29" rx="3" className="fill-white" stroke={ACTIVE} />
      <text x="160" y="41" fill={ACTIVE} textAnchor="middle" fontSize="15" fontWeight="700">8.00 m</text>
      <path d="M80 83L67 71M240 83L253 71M80 133L67 145M240 133L253 145" stroke={ACTIVE} strokeWidth="2" />
      <path d="M67 81V71H77M243 71H253V81M67 135V145H77M243 145H253V135" fill="none" stroke={ACTIVE} strokeWidth="2" />
    </svg>
  );
}

const STEPS = [
  {
    title: "바닥 모서리를 찾아요",
    body: "‘자동 인식’으로 바닥 모서리와 천장 비율을 찾아요. 어긋난 점만 끌어서 옮기거나, 두 벽과 바닥이 만나는 꼭짓점을 차례로 직접 찍어도 돼요.",
    image: () => <RoomIllustration mode="floor" />,
  },
  {
    title: "벽 하나의 길이로 바닥 크기를 맞춰요 (필수)",
    body: "도면에서 실제로 잰 바깥벽 하나를 고르고 길이(m)를 넣어요. 사진 속 모서리는 그대로 두고 바닥 크기만 키우거나 줄여요. 그다음 오른쪽에 실제 천장 높이를 넣어요 — 둘 다 해야 저장할 수 있어요.",
    image: () => <ScaleIllustration />,
  },
  {
    title: "천장선이 어긋날 때만 꼭짓점을 찍어요",
    body: "1인칭에서 천장이 어긋나면 ‘사진에서 천장 맞추기’를 누르세요. 화면을 위로 돌려, 이미 찍은 바닥 모서리 바로 위의 천장 꼭짓점 하나를 눌러요.",
    image: () => <RoomIllustration mode="ceiling" />,
  },
  {
    title: "1인칭에서 둘러보고 저장해요",
    body: "‘1인칭’에서 화면을 끌어 바닥과 천장이 벽에 맞는지 확인해요. 방 전체 모양은 ‘미니어처’에서 보고, 괜찮으면 ‘저장’을 누르세요.",
    image: () => <RoomIllustration mode="preview" />,
  },
] satisfies [RoomTutorialStep, ...RoomTutorialStep[]];

export function PanoramaTutorial({ onClose }: { onClose: () => void }) {
  return <RoomTutorial label="파노라마 방 만드는 법" seenKey={SEEN_KEY} steps={STEPS} onClose={onClose} />;
}
