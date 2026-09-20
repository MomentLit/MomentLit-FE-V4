import type { SpaceCategory } from "@/entities/space-category";
import type { DayOfWeek, SpaceAvailabilitySlot, SpaceCreateRequest } from "@/entities/space";

/**
 * 4-step space registration wizard state.
 *
 * Step 1 (기본정보) and Step 4 (일정열기) mirror fields that actually appear
 * in docs/design-reference.html's `#p-new` section. Step 2 (위치) and
 * Step 3 (이용조건) only exist there as stepper labels with no rendered
 * fields (see ANALYSIS.md §2.6) — their shape below is a reasonable filling
 * of that gap, not lifted from the reference markup.
 *
 * This is prototype-only client state (useState in RegistrationForm) — no
 * backend submission wiring in this scope.
 */

export const TOTAL_STEPS = 4;

export type UsageUnit = "HOURLY" | "DAILY";

export const USAGE_UNIT_LABELS: Record<UsageUnit, string> = {
  HOURLY: "시간 단위",
  DAILY: "일 단위",
};

/** 요일 — 월요일 시작. */
export const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
export type Day = (typeof DAYS)[number];

/** 한 번에 예약받을 시간 단위 — 예: 10:00~18:00를 2시간 단위로 열면 10-12/12-14/14-16/16-18 네 슬롯이 생긴다. */
export const BOOKING_UNIT_HOURS = [1, 2, 3, 4, 6, 8] as const;
export type BookingUnitHours = (typeof BOOKING_UNIT_HOURS)[number];

export interface DaySchedule {
  isOpen: boolean;
  /** "HH:mm" — `<input type="time">` 값 그대로. */
  startTime: string;
  endTime: string;
  unitHours: BookingUnitHours;
}

export type WeeklySchedule = Record<Day, DaySchedule>;

/** 기본값은 전부 휴무 — 호스트가 직접 여는 요일만 켠다. */
export function createInitialSchedule(): WeeklySchedule {
  const schedule = {} as WeeklySchedule;
  for (const day of DAYS) {
    schedule[day] = { isOpen: false, startTime: "10:00", endTime: "18:00", unitHours: 2 };
  }
  return schedule;
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeString(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

export interface RegistrationFormState {
  // Step 1 — 기본 정보
  name: string;
  category: SpaceCategory;
  area: string;
  capacity: string;
  description: string;
  /** Optional — selected via a plain file input, uploaded on submit via `uploadImage()`. */
  thumbnailFile: File | null;

  // Step 2 — 위치. Mirrors `AddressRequest` (see entities/space/model.ts) minus
  // `jibun_address`, which this prototype doesn't collect.
  sido: string;
  sigungu: string;
  eupMyeonDong: string;
  roadAddress: string;
  postalCode: string;
  addressDetail: string;

  // Step 3 — 이용 조건
  usageUnit: UsageUnit;
  pricePerUnit: string;
  /** UI-only — `SpaceCreateRequest` has no matching field, so this isn't sent on submit. */
  minUsageHours: string;
  floor: string;
  parkingInfo: string;

  // Step 4 — 일정 열기
  weeklySchedule: WeeklySchedule;
}

export function createInitialFormState(): RegistrationFormState {
  return {
    name: "",
    category: "POPUP_STORE",
    area: "",
    capacity: "",
    description: "",
    thumbnailFile: null,

    sido: "",
    sigungu: "",
    eupMyeonDong: "",
    roadAddress: "",
    postalCode: "",
    addressDetail: "",

    usageUnit: "HOURLY",
    pricePerUnit: "",
    minUsageHours: "",
    floor: "",
    parkingInfo: "",

    weeklySchedule: createInitialSchedule(),
  };
}

/** Parses a form text field into a number, or `undefined` when blank/invalid (for optional numeric API fields). */
function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Client-side gate before hitting the API — catches the obvious blanks so we
 * don't burn a round trip on a 400 for a required field (`road_address` and
 * `postal_code` in particular have no visual "required" marker in the UI).
 * Returns the first problem found, or `null` when the form is submittable.
 */
/**
 * 각 단계를 벗어나기 전에 그 단계 자신의 필수 항목만 검사한다 — 이게 없으면
 * 2단계 주소를 비워둔 채로 4단계까지 넘어가버리고, 에러는 "등록하기"를 누른
 * 4단계 화면에 뜨는데 실제 문제는 2단계에 있어서 사용자가 헤매게 된다.
 */
export function validateStep(step: number, state: RegistrationFormState): string | null {
  if (step === 1) {
    if (!state.name.trim()) return "공간 이름을 입력해 주세요.";
    if (!state.description.trim()) return "공간 소개를 입력해 주세요.";
    const area = toOptionalNumber(state.area);
    if (area !== undefined && area < 0) return "면적은 0 이상이어야 합니다.";
    const capacity = toOptionalNumber(state.capacity);
    if (capacity !== undefined && capacity < 0) return "수용 인원은 0 이상이어야 합니다.";
  }
  if (step === 2) {
    if (!state.sido.trim() || !state.sigungu.trim() || !state.eupMyeonDong.trim()) {
      return "시/도, 시/군/구, 읍/면/동을 입력해 주세요.";
    }
    if (!state.roadAddress.trim()) return "도로명 주소를 입력해 주세요.";
    if (!state.postalCode.trim()) return "우편번호를 입력해 주세요.";
  }
  if (step === 3) {
    const price = toOptionalNumber(state.pricePerUnit);
    if (price === undefined || price <= 0) return "요금을 입력해 주세요.";
  }
  return null;
}

export function validateRegistrationForm(state: RegistrationFormState): string | null {
  if (!state.name.trim()) return "공간 이름을 입력해 주세요.";
  if (!state.description.trim()) return "공간 소개를 입력해 주세요.";
  if (!state.sido.trim() || !state.sigungu.trim() || !state.eupMyeonDong.trim()) {
    return "시/도, 시/군/구, 읍/면/동을 입력해 주세요.";
  }
  if (!state.roadAddress.trim()) return "도로명 주소를 입력해 주세요.";
  if (!state.postalCode.trim()) return "우편번호를 입력해 주세요.";
  const area = toOptionalNumber(state.area);
  if (area !== undefined && area < 0) return "면적은 0 이상이어야 합니다.";
  const capacity = toOptionalNumber(state.capacity);
  if (capacity !== undefined && capacity < 0) return "수용 인원은 0 이상이어야 합니다.";
  const price = toOptionalNumber(state.pricePerUnit);
  if (price === undefined || price <= 0) return "요금을 입력해 주세요.";
  for (const day of DAYS) {
    const daySchedule = state.weeklySchedule[day];
    if (daySchedule.isOpen && parseTimeToMinutes(daySchedule.endTime) <= parseTimeToMinutes(daySchedule.startTime)) {
      return `${day}요일의 종료 시간은 시작 시간보다 늦어야 합니다.`;
    }
  }
  return null;
}

export interface SpaceSubmitOptions {
  thumbnailUrl?: string;
  isDraft?: boolean;
}

/** Maps the wizard's local state onto the real `SpaceCreateRequest` wire shape. */
export function toSpaceCreateRequest(
  state: RegistrationFormState,
  options: SpaceSubmitOptions = {},
): SpaceCreateRequest {
  return {
    name: state.name.trim(),
    description: state.description.trim(),
    address: {
      sido: state.sido.trim(),
      sigungu: state.sigungu.trim(),
      eup_myeon_dong: state.eupMyeonDong.trim(),
      road_address: state.roadAddress.trim(),
      detail_address: state.addressDetail.trim() || undefined,
      postal_code: state.postalCode.trim(),
    },
    thumbnail_url: options.thumbnailUrl,
    price_per_hour: toOptionalNumber(state.pricePerUnit) ?? 0,
    category: state.category,
    area: toOptionalNumber(state.area),
    capacity: toOptionalNumber(state.capacity),
    floor: state.floor.trim() || undefined,
    parking_info: state.parkingInfo.trim() || undefined,
    usage_unit: state.usageUnit,
    is_draft: options.isDraft,
  };
}

/** 요일 → 백엔드 `DayOfWeek` enum. */
const DAY_TO_DAY_OF_WEEK: Record<Day, DayOfWeek> = {
  월: "MONDAY",
  화: "TUESDAY",
  수: "WEDNESDAY",
  목: "THURSDAY",
  금: "FRIDAY",
  토: "SATURDAY",
  일: "SUNDAY",
};

/**
 * 요일마다 [시작,종료) 구간을 `unitHours` 크기로 잘라 개별 예약 슬롯으로 만든다 —
 * 예: 10:00~18:00를 2시간 단위로 열면 10-12/12-14/14-16/16-18 네 개의 별도 슬롯이
 * 생겨서, 게스트가 공간 상세 페이지에서 그중 원하는 시간대 하나를 골라 예약할 수 있다.
 * `PUT /spaces/{id}/availability`는 보낸 것으로 그 주를 통째로 덮어쓰므로(diff 아님)
 * 닫힌 요일은 아예 슬롯을 만들지 않는다 — 존재하지 않으면 곧 "닫힘"과 같다.
 * 나누어떨어지지 않는 나머지 시간(예: 7시간을 2시간 단위로 → 마지막 1시간)은 버린다.
 */
export function toAvailabilitySlots(schedule: WeeklySchedule): SpaceAvailabilitySlot[] {
  const slots: SpaceAvailabilitySlot[] = [];
  for (const day of DAYS) {
    const { isOpen, startTime, endTime, unitHours } = schedule[day];
    if (!isOpen) continue;

    const startMinutes = parseTimeToMinutes(startTime);
    const endMinutes = parseTimeToMinutes(endTime);
    if (endMinutes <= startMinutes) continue;

    const unitMinutes = unitHours * 60;
    for (let cursor = startMinutes; cursor + unitMinutes <= endMinutes; cursor += unitMinutes) {
      slots.push({
        day_of_week: DAY_TO_DAY_OF_WEEK[day],
        start_time: minutesToTimeString(cursor),
        end_time: minutesToTimeString(cursor + unitMinutes),
        is_open: true,
      });
    }
  }
  return slots;
}

export const STEP_META = [
  { step: 1, label: "Step 01", title: "기본 정보" },
  { step: 2, label: "Step 02", title: "위치" },
  { step: 3, label: "Step 03", title: "이용 조건" },
  { step: 4, label: "Step 04", title: "일정 열기" },
] as const;
