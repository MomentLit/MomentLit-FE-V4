import { cn } from "@/shared/lib";
import { PRICE_INQUIRY_LABEL } from "@/entities/space";
import { FormField, fieldInputClass } from "./FormField";

export interface PriceFieldProps {
  label: string;
  price: string;
  priceInquiry: boolean;
  onPriceChange: (price: string) => void;
  onPriceInquiryChange: (priceInquiry: boolean) => void;
}

/**
 * 요금 칸 + "문의 바람" — 켜면 요금 대신 "가격 문의"로 노출하고 요금은 보내지 않는다.
 * 입력해 둔 요금은 지우지 않아서 다시 끄면 그대로 돌아온다. 등록 마법사(구역마다)와 수정 폼이 같이 쓴다.
 */
export function PriceField({ label, price, priceInquiry, onPriceChange, onPriceInquiryChange }: PriceFieldProps) {
  return (
    <FormField label={label} hint={priceInquiry ? `요금 대신 "${PRICE_INQUIRY_LABEL}"로 보여요.` : undefined}>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={0}
          value={priceInquiry ? "" : price}
          onChange={(e) => onPriceChange(e.target.value)}
          disabled={priceInquiry}
          placeholder={priceInquiry ? PRICE_INQUIRY_LABEL : undefined}
          aria-label={label}
          className={cn(fieldInputClass, "min-w-0 flex-1 disabled:cursor-not-allowed disabled:bg-wash")}
        />
        <label className="flex flex-none cursor-pointer items-center gap-1.5 text-sm font-bold text-ink">
          <input
            type="checkbox"
            checked={priceInquiry}
            onChange={(e) => onPriceInquiryChange(e.target.checked)}
            className="accent-primary-500"
          />
          문의 바람
        </label>
      </div>
    </FormField>
  );
}
