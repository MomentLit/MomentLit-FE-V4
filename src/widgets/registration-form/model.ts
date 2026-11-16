import type { SpaceCategory } from "@/entities/space-category";
import {
  isValidExternalBookingUrl,
  joinSpaceDescription,
  joinSpaceOptionName,
  type BookingType,
  type DayOfWeek,
  type SpaceAvailabilitySlot,
  type SpaceCreateRequest,
  type SpaceDetail,
} from "@/entities/space";
import type { PhotoItem } from "@/shared/ui/MultiPhotoUpload";
import { toPanoramaSceneRequests, type PanoramaTourScene } from "@/widgets/panorama/model";

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

/** 일괄 설정의 요일 빠른 선택. */
export const DAY_PRESETS: { label: string; days: readonly Day[] }[] = [
  { label: "평일", days: ["월", "화", "수", "목", "금"] },
  { label: "주말", days: ["토", "일"] },
  { label: "매일", days: DAYS },
];

/**
 * "모두 동일 시간으로 설정" — 고른 요일은 같은 시간·예약 단위로 열고, 나머지 요일은 휴무로 만든다.
 * 고르지 않은 요일의 시간 값은 남겨둬서, 나중에 다시 켜면 이전 시간이 그대로 보인다.
 */
export function applyScheduleToDays(
  schedule: WeeklySchedule,
  days: readonly Day[],
  template: Omit<DaySchedule, "isOpen">,
): WeeklySchedule {
  const selected = new Set(days);
  const next = {} as WeeklySchedule;
  for (const day of DAYS) {
    next[day] = selected.has(day) ? { ...template, isOpen: true } : { ...schedule[day], isOpen: false };
  }
  return next;
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

/**
 * 예약 규칙 — 연속 예약, 최소 이용 시간, 인원 초과 요금. 등록 마법사(구역마다)와 수정 폼이 같이 쓴다.
 * 입력 칸 값 그대로(문자열) 들고 있다가 보낼 때 `toBookingRulesRequest`로 바꾼다.
 */
export interface BookingRulesState {
  /** 이어진 예약 슬롯 여러 개를 한 번에 예약받을지. 새 공간은 켜고, 기존 공간은 서버 값(기본 꺼짐)을 따른다. */
  allowConsecutiveBooking: boolean;
  /** 시간 단위 공간만 — 비우면 제한 없음. */
  minUsageHours: string;
  extraGuestEnabled: boolean;
  baseGuestCount: string;
  /** 초과 1인당 요금(이용 단위당). */
  extraGuestFee: string;
}

export function createInitialBookingRules(): BookingRulesState {
  return {
    allowConsecutiveBooking: true,
    minUsageHours: "",
    extraGuestEnabled: false,
    baseGuestCount: "",
    extraGuestFee: "",
  };
}

/** 수정 폼 — 서버 값으로 채운다. 백엔드 배포 전 응답에 없으면 기존 동작(연속 예약 꺼짐, 제한 없음)으로 본다. */
export function bookingRulesFromSpace(
  space: Pick<SpaceDetail, "allow_consecutive_booking" | "min_usage_hours" | "base_guest_count" | "extra_guest_fee">,
): BookingRulesState {
  const hasExtraGuestFee = space.base_guest_count != null && space.extra_guest_fee != null;
  return {
    allowConsecutiveBooking: space.allow_consecutive_booking === true,
    minUsageHours: space.min_usage_hours != null ? String(space.min_usage_hours) : "",
    extraGuestEnabled: hasExtraGuestFee,
    baseGuestCount: hasExtraGuestFee ? String(space.base_guest_count) : "",
    extraGuestFee: hasExtraGuestFee ? String(space.extra_guest_fee) : "",
  };
}

function isWholeNumber(value: string, min: number): boolean {
  const parsed = Number(value.trim());
  return value.trim() !== "" && Number.isInteger(parsed) && parsed >= min;
}

/** 백엔드 `Space.updateMinUsageHours`/`updateExtraGuestFee`와 같은 기준. 문제가 없으면 null. */
export function validateBookingRules(rules: BookingRulesState, usageUnit: UsageUnit | null, capacity: string): string | null {
  if (usageUnit !== "DAILY" && rules.minUsageHours.trim() && !isWholeNumber(rules.minUsageHours, 0)) {
    return "최소 이용 시간은 시간 단위 정수로 입력해 주세요.";
  }
  if (!rules.extraGuestEnabled) return null;
  if (!isWholeNumber(rules.baseGuestCount, 1)) return "추가 요금의 기준 인원을 1명 이상으로 입력해 주세요.";
  if (!isWholeNumber(rules.extraGuestFee, 1)) return "초과 1인당 추가 요금을 입력해 주세요.";
  const maxCapacity = toOptionalNumber(capacity);
  if (maxCapacity !== undefined && maxCapacity > 0 && Number(rules.baseGuestCount) > maxCapacity) {
    return "추가 요금의 기준 인원은 최대 수용 인원보다 많을 수 없어요.";
  }
  return null;
}

type BookingRulesRequest = Pick<
  SpaceCreateRequest,
  "allow_consecutive_booking" | "min_usage_hours" | "base_guest_count" | "extra_guest_fee"
>;

/**
 * 등록(`create`)은 설정한 값만 보낸다. 수정(`update`)은 비운 값을 지우도록 0을 보낸다 —
 * 백엔드는 `min_usage_hours`/`extra_guest_fee`가 0이면 삭제, 생략하면 변경 없음으로 처리한다.
 * 일 단위 공간은 최소 이용 시간을 쓰지 않으므로 지운다.
 */
export function toBookingRulesRequest(
  rules: BookingRulesState,
  usageUnit: UsageUnit | null,
  mode: "create" | "update",
): BookingRulesRequest {
  const clear = mode === "update" ? 0 : undefined;
  const minUsageHours = usageUnit !== "DAILY" ? toOptionalNumber(rules.minUsageHours) : undefined;
  return {
    allow_consecutive_booking: rules.allowConsecutiveBooking,
    min_usage_hours: minUsageHours && minUsageHours > 0 ? minUsageHours : clear,
    base_guest_count: rules.extraGuestEnabled ? Number(rules.baseGuestCount) : undefined,
    extra_guest_fee: rules.extraGuestEnabled ? Number(rules.extraGuestFee) : clear,
  };
}

/**
 * 한 공간 안에서 따로 빌려주는 구역(예: 1층, 2층 세미나실) 하나. 백엔드에는 "옵션"
 * 개념이 없어서 구역마다 Space를 하나씩 만들고, 이름을 `공간 이름 · 구역 이름`으로
 * 맞춰서 상세 페이지가 같은 공간의 구역끼리 묶어 보여준다 (`splitSpaceOptionName`).
 * 구역이 하나뿐이면 구역 이름 없이 공간 이름 그대로 등록한다.
 */
export interface SpaceOptionState extends BookingRulesState {
  /** 화면 key 전용 — 서버로 보내지 않는다. */
  id: string;
  label: string;
  /** 구역별 소개 — `separateDescriptions`가 켜져 있을 때만 쓴다(꺼져 있으면 공통 소개를 보낸다). */
  description: string;
  area: string;
  capacity: string;
  /** Optional — 고르기만 해두고 제출할 때 `resolvePhotoUrls()`로 한 번에 업로드한다. 첫 번째가 대표 사진. */
  photos: PhotoItem[];
  /**
   * Optional — 360° scenes; the first one is the starting scene. Each photo is already uploaded (or AI-stitched) by
   * `PanoramaUploadModal`, so `image_url` is the final S3 URL.
   */
  panoramaScenes: PanoramaTourScene[];
  usageUnit: UsageUnit;
  pricePerUnit: string;
  /** "문의 바람" — 켜면 요금 대신 "가격 문의"로 노출하고 `pricePerUnit`은 보내지 않는다. */
  priceInquiry: boolean;
  floor: string;
  weeklySchedule: WeeklySchedule;
}

export interface RegistrationFormState {
  // Step 1 — 기본 정보 (구역 공통)
  name: string;
  category: SpaceCategory;
  description: string;
  /** 구역마다 소개를 따로 쓸지 — 구역이 2개 이상일 때만 의미가 있다(`usesSeparateDescriptions`). */
  separateDescriptions: boolean;
  /** 기타사항(이용 수칙·주의사항·추가 비용) — 선택. 저장할 때 소개 뒤에 붙인다(`joinSpaceDescription`). */
  notice: string;

  // Step 2 — 위치. Mirrors `AddressRequest` (see entities/space/model.ts) minus
  // `jibun_address`, which this prototype doesn't collect.
  sido: string;
  sigungu: string;
  eupMyeonDong: string;
  roadAddress: string;
  postalCode: string;
  addressDetail: string;

  // Step 3 — 이용 조건 (구역 공통)
  parkingInfo: string;
  bookingType: BookingType;
  /** EXTERNAL일 때만 전송. */
  externalBookingUrl: string;

  /** 구역별 정보(면적·인원·사진·요금·층수·운영 시간) — 항상 1개 이상. */
  options: SpaceOptionState[];
}

let optionSeq = 0;

export function createOptionState(base?: SpaceOptionState): SpaceOptionState {
  optionSeq += 1;
  return {
    id: `option-${Date.now()}-${optionSeq}`,
    label: "",
    description: "",
    area: "",
    capacity: "",
    photos: [],
    panoramaScenes: [],
    // 새 구역은 보통 요금 체계·운영 시간이 비슷해서 지금 구역 값을 이어받는다 — 사진·이름은 구역마다 다르니 비운다.
    usageUnit: base?.usageUnit ?? "HOURLY",
    pricePerUnit: base?.pricePerUnit ?? "",
    priceInquiry: base?.priceInquiry ?? false,
    ...(base
      ? {
          allowConsecutiveBooking: base.allowConsecutiveBooking,
          minUsageHours: base.minUsageHours,
          extraGuestEnabled: base.extraGuestEnabled,
          baseGuestCount: base.baseGuestCount,
          extraGuestFee: base.extraGuestFee,
        }
      : createInitialBookingRules()),
    floor: "",
    weeklySchedule: base ? structuredClone(base.weeklySchedule) : createInitialSchedule(),
  };
}

export function createInitialFormState(): RegistrationFormState {
  return {
    name: "",
    category: "POPUP_STORE",
    description: "",
    separateDescriptions: false,
    notice: "",

    sido: "",
    sigungu: "",
    eupMyeonDong: "",
    roadAddress: "",
    postalCode: "",
    addressDetail: "",

    parkingInfo: "",
    bookingType: "INTERNAL",
    externalBookingUrl: "",

    options: [createOptionState()],
  };
}

/** 화면에 보일 구역 이름 — 비어 있으면 순번으로 대신한다. */
export function optionDisplayLabel(option: SpaceOptionState, index: number): string {
  return option.label.trim() || `구역 ${index + 1}`;
}

/** 구역별 소개를 실제로 쓰는지 — 켜 두었어도 구역이 하나만 남으면 공통 소개를 쓴다. */
export function usesSeparateDescriptions(state: Pick<RegistrationFormState, "separateDescriptions" | "options">): boolean {
  return state.separateDescriptions && state.options.length > 1;
}

/** 이 구역으로 보낼 소개 — 구역별 소개를 쓰면 구역 것, 아니면 공통 소개. */
export function optionDescription(state: RegistrationFormState, option: SpaceOptionState): string {
  return usesSeparateDescriptions(state) ? option.description : state.description;
}

/** 모먼트릿에서 예약을 받는 공간만 4단계 주간 일정이 필요하다 — 외부 예약 공간은 홈페이지에서 예약을 받는다. */
export function usesWeeklySchedule(state: Pick<RegistrationFormState, "bookingType">): boolean {
  return state.bookingType !== "EXTERNAL";
}

/** Parses a form text field into a number, or `undefined` when blank/invalid (for optional numeric API fields). */
function toOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** 검증 실패 — 구역별 항목이면 어느 구역인지(`optionIndex`)도 알려줘서 그 구역 탭을 바로 열어준다. */
export interface ValidationError {
  message: string;
  optionIndex?: number;
}

function optionError(state: RegistrationFormState, index: number, message: string): ValidationError {
  const prefix = state.options.length > 1 ? `[${optionDisplayLabel(state.options[index], index)}] ` : "";
  return { message: prefix + message, optionIndex: index };
}

function validateOptionLabels(state: RegistrationFormState): ValidationError | null {
  if (state.options.length < 2) return null;
  const seen = new Set<string>();
  for (const [index, option] of state.options.entries()) {
    const label = option.label.trim();
    if (!label) return optionError(state, index, "구역 이름을 입력해 주세요. 예: 1층, 2층 세미나실");
    if (seen.has(label)) return optionError(state, index, "구역 이름이 겹쳐요. 구역마다 다른 이름을 써 주세요.");
    seen.add(label);
  }
  return null;
}

function validateBasicInfo(state: RegistrationFormState): ValidationError | null {
  if (!state.name.trim()) return { message: "공간 이름을 입력해 주세요." };
  const separate = usesSeparateDescriptions(state);
  if (!separate && !state.description.trim()) return { message: "공간 소개를 입력해 주세요." };
  const labelError = validateOptionLabels(state);
  if (labelError) return labelError;
  for (const [index, option] of state.options.entries()) {
    if (separate && !option.description.trim()) return optionError(state, index, "구역 소개를 입력해 주세요.");
    const area = toOptionalNumber(option.area);
    if (area !== undefined && area < 0) return optionError(state, index, "면적은 0 이상이어야 합니다.");
    const capacity = toOptionalNumber(option.capacity);
    if (capacity !== undefined && capacity < 0) return optionError(state, index, "수용 인원은 0 이상이어야 합니다.");
  }
  return null;
}

function validateLocation(state: RegistrationFormState): ValidationError | null {
  if (!state.sido.trim() || !state.sigungu.trim() || !state.eupMyeonDong.trim()) {
    return { message: "시/도, 시/군/구, 읍/면/동을 입력해 주세요." };
  }
  if (!state.roadAddress.trim()) return { message: "주소 검색으로 도로명 주소를 선택해 주세요." };
  if (!state.roadAddress.trim().startsWith(state.sido.trim()) ||
      !state.roadAddress.includes(state.sigungu.trim())) {
    return { message: "시/도와 시/군/구를 포함한 전체 도로명 주소를 입력해 주세요." };
  }
  if (!state.postalCode.trim()) return { message: "우편번호를 입력해 주세요." };
  return null;
}

function validateTerms(state: RegistrationFormState): ValidationError | null {
  for (const [index, option] of state.options.entries()) {
    if (option.priceInquiry) continue;
    const price = toOptionalNumber(option.pricePerUnit);
    if (price === undefined || price <= 0) return optionError(state, index, "요금을 입력해 주세요.");
  }
  // 외부 예약 공간은 예약 규칙 칸을 보여주지 않는다.
  for (const [index, option] of usesWeeklySchedule(state) ? state.options.entries() : []) {
    const rulesError = validateBookingRules(option, option.usageUnit, option.capacity);
    if (rulesError) return optionError(state, index, rulesError);
  }
  if (state.bookingType === "EXTERNAL" && !isValidExternalBookingUrl(state.externalBookingUrl)) {
    return { message: "예약 페이지 링크를 http:// 또는 https://로 시작하는 주소로 입력해 주세요." };
  }
  return null;
}

function validateSchedule(state: RegistrationFormState): ValidationError | null {
  // 외부 예약 공간은 주간 일정을 쓰지 않으므로(제출 때도 보내지 않음) 검증하지 않는다.
  if (!usesWeeklySchedule(state)) return null;
  for (const [index, option] of state.options.entries()) {
    for (const day of DAYS) {
      const daySchedule = option.weeklySchedule[day];
      if (daySchedule.isOpen && parseTimeToMinutes(daySchedule.endTime) <= parseTimeToMinutes(daySchedule.startTime)) {
        return optionError(state, index, `${day}요일의 종료 시간은 시작 시간보다 늦어야 합니다.`);
      }
      // 연속 예약을 끄면 슬롯 하나만 예약할 수 있어서, 최소 이용 시간이 예약 단위보다 길면 아무도 예약할 수 없다.
      const minUsageHours = option.usageUnit !== "DAILY" ? toOptionalNumber(option.minUsageHours) ?? 0 : 0;
      if (daySchedule.isOpen && !option.allowConsecutiveBooking && minUsageHours > daySchedule.unitHours) {
        return optionError(
          state,
          index,
          `${day}요일 예약 단위(${daySchedule.unitHours}시간)가 최소 이용 시간(${minUsageHours}시간)보다 짧아요. 연속 예약을 켜거나 예약 단위를 늘려 주세요.`,
        );
      }
    }
  }
  return null;
}

/**
 * 각 단계를 벗어나기 전에 그 단계 자신의 필수 항목만 검사한다 — 이게 없으면
 * 2단계 주소를 비워둔 채로 4단계까지 넘어가버리고, 에러는 "등록하기"를 누른
 * 4단계 화면에 뜨는데 실제 문제는 2단계에 있어서 사용자가 헤매게 된다.
 */
export function validateStep(step: number, state: RegistrationFormState): ValidationError | null {
  if (step === 1) return validateBasicInfo(state);
  if (step === 2) return validateLocation(state);
  if (step === 3) return validateTerms(state);
  if (step === 4) return validateSchedule(state);
  return null;
}

/** 제출 직전 전체 검사 — 문제가 있는 첫 단계(`step`)를 함께 돌려준다. */
export function validateRegistrationForm(state: RegistrationFormState): (ValidationError & { step: number }) | null {
  for (let step = 1; step <= TOTAL_STEPS; step += 1) {
    const error = validateStep(step, state);
    if (error) return { ...error, step };
  }
  return null;
}

export interface SpaceSubmitOptions {
  /** 업로드가 끝난 사진 URL — 첫 번째가 대표 사진(`thumbnail_url`). */
  imageUrls?: string[];
  isDraft?: boolean;
}

/** Maps the wizard's local state (공통 정보 + 구역 하나) onto the real `SpaceCreateRequest` wire shape. */
export function toSpaceCreateRequest(
  state: RegistrationFormState,
  option: SpaceOptionState,
  options: SpaceSubmitOptions = {},
): SpaceCreateRequest {
  const name = state.name.trim();
  return {
    name: state.options.length > 1 ? joinSpaceOptionName(name, option.label.trim()) : name,
    description: joinSpaceDescription(optionDescription(state, option), state.notice),
    address: {
      sido: state.sido.trim(),
      sigungu: state.sigungu.trim(),
      eup_myeon_dong: state.eupMyeonDong.trim(),
      road_address: state.roadAddress.trim(),
      detail_address: state.addressDetail.trim() || undefined,
      postal_code: state.postalCode.trim(),
    },
    thumbnail_url: options.imageUrls?.[0],
    image_urls: options.imageUrls?.length ? options.imageUrls : undefined,
    // 서버가 하위 호환용 `panorama_url`을 첫 장면으로 맞춘다.
    panorama_scenes: option.panoramaScenes.length > 0 ? toPanoramaSceneRequests(option.panoramaScenes) : undefined,
    price_per_hour: option.priceInquiry ? undefined : toOptionalNumber(option.pricePerUnit) ?? 0,
    price_inquiry: option.priceInquiry,
    category: state.category,
    area: toOptionalNumber(option.area),
    capacity: toOptionalNumber(option.capacity),
    floor: option.floor.trim() || undefined,
    parking_info: state.parkingInfo.trim() || undefined,
    usage_unit: option.usageUnit,
    is_draft: options.isDraft,
    booking_type: state.bookingType,
    external_booking_url: state.bookingType === "EXTERNAL" ? state.externalBookingUrl.trim() : undefined,
    ...toBookingRulesRequest(option, option.usageUnit, "create"),
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
