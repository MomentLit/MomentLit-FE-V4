const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 끝에 `Z`나 `+09:00`·`-0500` 같은 시간대 정보가 붙어 있는지. */
const HAS_ZONE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * 저장한 배치의 `updated_at`을 한국 시간 `M/D HH:mm`으로 바꾼다.
 *
 * 백엔드는 `updated_at`을 서버(UTC) 기준 `LocalDateTime`으로, 시간대 없이 `2026-11-25T14:47:00`처럼 내려준다.
 * 그래서 시간대가 없으면 UTC로 읽고 9시간을 더해 KST로 맞춘다. 더한 뒤 UTC 필드로 읽으므로
 * 자정·월말·연말을 넘기면 날짜도 함께 넘어가고, 보는 사람의 브라우저 시간대와는 상관없다.
 */
export function formatLayoutSavedAt(value: string): string {
  const trimmed = value.trim();
  const date = new Date(HAS_ZONE.test(trimmed) ? trimmed : `${trimmed}Z`);
  if (Number.isNaN(date.getTime())) return "";
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;
}
