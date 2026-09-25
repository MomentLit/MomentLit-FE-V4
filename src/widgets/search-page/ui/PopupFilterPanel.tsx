import { REGIONS, REGION_LABELS, type Region } from "@/entities/region";
import { POPUP_CATEGORIES, POPUP_CATEGORY_LABELS, POPUP_CATEGORY_TONES, type PopupCategory } from "../lib/popup-filters";
import { TONE_DOT_BG } from "./tone-dot";

interface PopupFilterPanelProps {
  selectedRegion: Region | null;
  onSelectRegion: (region: Region | null) => void;
  selectedCategory: PopupCategory | null;
  onSelectCategory: (category: PopupCategory | null) => void;
  date: string | null;
  onDateChange: (date: string | null) => void;
}

/**
 * Popup filter fields (date/region/category) — same shape/markup as space's
 * FilterPanel, minus capacity/usage-unit (popups have no matching data for
 * either). All three are filtered client-side since `GET /popups` has no
 * filter params — see `../lib/popup-filters`. Category has no backend field
 * at all, so it's guessed from the title (`guessPopupCategory`), a
 * heuristic, not real data. Counts aren't shown for the same reason space's
 * come from `regionCounts`/`categoryCounts` endpoints that don't exist here.
 * The shared aside shell lives in `SearchPageContent` — see FilterPanel's
 * docstring for why.
 */
export function PopupFilterPanel({
  selectedRegion,
  onSelectRegion,
  selectedCategory,
  onSelectCategory,
  date,
  onDateChange,
}: PopupFilterPanelProps) {
  return (
    <>
      <div className="flex flex-col gap-2.5">
        <span className="flex items-center justify-between border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
          날짜
          {date && (
            <button type="button" onClick={() => onDateChange(null)} className="normal-case text-ink hover:underline">
              초기화
            </button>
          )}
        </span>
        <input
          type="date"
          value={date ?? ""}
          min={new Date().toISOString().slice(0, 10)}
          onChange={(e) => onDateChange(e.target.value || null)}
          aria-label="날짜"
          className="border border-line px-2.5 py-2 text-[0.86rem] text-ink outline-none focus:border-sky"
        />
        {date && <span className="text-[0.76rem] text-soft">이 날짜에 진행 중인 팝업만 보여요.</span>}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
          지역
        </span>
        {REGIONS.map((region) => (
          <label key={region} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={selectedRegion === region}
              onChange={() => onSelectRegion(selectedRegion === region ? null : region)}
              className="h-[15px] w-[15px] flex-none accent-sky"
            />
            <span className="min-w-0 flex-1 text-ink">{REGION_LABELS[region]}</span>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="border-b border-line pb-2 text-[0.66rem] font-medium uppercase tracking-[0.18em] text-soft">
          카테고리
        </span>
        {POPUP_CATEGORIES.map((category) => (
          <label key={category} className="flex cursor-pointer items-center gap-2.5 text-[0.86rem]">
            <input
              type="checkbox"
              checked={selectedCategory === category}
              onChange={() => onSelectCategory(selectedCategory === category ? null : category)}
              className="h-[15px] w-[15px] flex-none accent-sky"
            />
            <i
              className={`block h-2 w-2 flex-none ${TONE_DOT_BG[POPUP_CATEGORY_TONES[category]]}`}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 text-ink">{POPUP_CATEGORY_LABELS[category]}</span>
          </label>
        ))}
      </div>
    </>
  );
}
