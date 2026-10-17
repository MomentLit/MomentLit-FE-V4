import type { ReactNode } from "react";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { cn } from "@/shared/lib";
import { fieldInputClass } from "./FormField";
import { optionDisplayLabel, type SpaceOptionState } from "./model";

/** 한 공간에 만들 수 있는 구역 수 — 구역마다 Space가 하나씩 생기므로 너무 많지 않게 묶어둔다. */
export const MAX_SPACE_OPTIONS = 10;

export interface OptionTabsProps {
  options: SpaceOptionState[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onLabelChange: (label: string) => void;
  /** 이 단계에서 구역마다 따로 정하는 항목 — 탭 아래에 그대로 그린다. */
  children: ReactNode;
}

/** 1·3·4단계가 받는 구역 관련 props — 탭 상태와, 지금 열린 구역의 항목을 바꾸는 함수. */
export interface OptionStepProps {
  optionTabs: Omit<OptionTabsProps, "children">;
  onOptionChange: <K extends keyof SpaceOptionState>(key: K, value: SpaceOptionState[K]) => void;
}

/**
 * 1층·2층처럼 한 공간 안에서 따로 빌려주는 구역을 고르는 탭. 1·3·4단계에서 같은
 * 탭을 공유해서(활성 구역은 RegistrationForm이 들고 있음) 구역별 사진·인원·요금·
 * 운영 시간을 이어서 채울 수 있다. 구역이 하나면 탭 대신 "구역 추가"만 보인다.
 */
export function OptionTabs({ options, activeIndex, onSelect, onAdd, onRemove, onLabelChange, children }: OptionTabsProps) {
  const multiple = options.length > 1;
  const active = options[activeIndex];
  const canAdd = options.length < MAX_SPACE_OPTIONS;

  return (
    <section className="flex flex-col gap-4.5 sm:col-span-2" aria-label="구역별 정보">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <span className="text-lg font-bold tracking-tight text-ink">{multiple ? "구역별 정보" : "구역"}</span>
          {canAdd && (
            <button type="button" onClick={onAdd} className="button button--outline">
              <IconPlus size={16} stroke={2} aria-hidden />
              구역 추가
            </button>
          )}
        </div>
        {!multiple && (
          <span className="text-[0.79rem] text-soft">
            1층·2층처럼 따로 빌려주는 구역이 있으면 구역을 추가해 주세요. 구역마다 사진·인원·요금·운영 시간을 따로 정할 수 있어요.
          </span>
        )}
        {multiple && (
          <div role="tablist" aria-label="구역 선택" className="flex flex-wrap gap-px bg-line shadow-[0_0_0_1px_var(--line)]">
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={index === activeIndex}
                onClick={() => onSelect(index)}
                className={cn(
                  "min-w-24 flex-1 px-4 py-3 text-sm font-bold transition-colors",
                  index === activeIndex ? "bg-primary-100 text-ink" : "bg-white text-ink hover:bg-wash",
                  !option.label.trim() && index !== activeIndex && "text-soft",
                )}
              >
                {optionDisplayLabel(option, index)}
              </button>
            ))}
          </div>
        )}
      </div>

      {multiple && active && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">구역 이름</span>
            <input
              type="text"
              value={active.label}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="예: 1층, 2층 세미나실"
              aria-label="구역 이름"
              className={fieldInputClass}
            />
          </label>
          <button type="button" onClick={() => onRemove(activeIndex)} className="button button--outline">
            <IconTrash size={16} stroke={2} aria-hidden />
            이 구역 삭제
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
