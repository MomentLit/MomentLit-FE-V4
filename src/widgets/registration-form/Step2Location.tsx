import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Script from "next/script";
import { Modal } from "@/shared/ui/Modal";
import { FormField, fieldInputClass } from "./FormField";
import type { RegistrationFormState } from "./model";

type PostcodeResult = {
  roadAddress: string;
  sido: string;
  sigungu: string;
  bname: string;
  bname1: string;
  bname2: string;
  zonecode: string;
};

declare global {
  interface Window {
    kakao?: {
      Postcode: new (options: {
        oncomplete: (result: PostcodeResult) => void;
        shorthand?: boolean;
        width?: string;
        height?: string;
      }) => { embed: (element: HTMLElement, options?: { autoClose?: boolean }) => void };
    };
  }
}

export type SelectedAddress = Pick<
  RegistrationFormState,
  "roadAddress" | "sido" | "sigungu" | "eupMyeonDong" | "postalCode"
>;

export interface Step2LocationProps {
  state: RegistrationFormState;
  onFieldChange: <K extends keyof RegistrationFormState>(
    key: K,
    value: RegistrationFormState[K],
  ) => void;
  onAddressSelect: (address: SelectedAddress) => void;
}

/** Choose one verified road address, then keep the backend's separate address fields in sync. */
export function Step2Location({ state, onFieldChange, onAddressSelect }: Step2LocationProps) {
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const embedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen || !scriptReady || !embedRef.current) return;
    if (!window.kakao?.Postcode) return;
    new window.kakao.Postcode({
      shorthand: false,
      width: "100%",
      height: "100%",
      oncomplete: (result) => {
        if (!result.roadAddress) {
          setSearchError("도로명 주소가 없는 결과예요. 다른 주소를 선택해 주세요.");
          return;
        }
        const eupMyeonDong = result.bname1 || result.bname2 || result.bname;
        onAddressSelect({
          roadAddress: result.roadAddress,
          sido: result.sido,
          sigungu: result.sigungu,
          eupMyeonDong,
          postalCode: result.zonecode,
        });
        setSearchError(null);
        setSearchOpen(false);
      },
    }).embed(embedRef.current, { autoClose: false });
  }, [searchOpen, scriptReady, onAddressSelect]);

  return (
    <>
      <Script
        src="https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="afterInteractive"
        onReady={() => {
          setScriptReady(Boolean(window.kakao?.Postcode));
          setScriptError(!window.kakao?.Postcode);
        }}
        onError={() => setScriptError(true)}
      />
      <div className="grid grid-cols-1 gap-4.5 sm:grid-cols-2">
        <FormField label="도로명 주소" full hint="주소 검색에서 선택하면 지역과 우편번호가 자동으로 입력돼요.">
          <div className="flex gap-2">
            <input
              type="text"
              value={state.roadAddress}
              readOnly
              placeholder="주소 검색으로 전체 도로명주소를 선택해 주세요"
              aria-label="도로명 주소"
              className={`${fieldInputClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              className="button button--outline shrink-0"
              disabled={scriptError}
              onClick={() => { setSearchError(null); setSearchOpen(true); }}
            >
              주소 검색
            </button>
          </div>
        </FormField>

        {scriptError && <p role="alert" className="text-sm text-coral sm:col-span-2">주소 검색을 불러오지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.</p>}

        <FormField label="시 / 도">
          <input type="text" value={state.sido} readOnly placeholder="예: 서울특별시" aria-label="시/도" className={fieldInputClass} />
        </FormField>
        <FormField label="시 / 군 / 구">
          <input type="text" value={state.sigungu} readOnly placeholder="예: 마포구" aria-label="시/군/구" className={fieldInputClass} />
        </FormField>
        <FormField label="읍 / 면 / 동">
          <input type="text" value={state.eupMyeonDong} readOnly placeholder="예: 서교동" aria-label="읍/면/동" className={fieldInputClass} />
        </FormField>
        <FormField label="우편번호">
          <input type="text" value={state.postalCode} readOnly placeholder="예: 04039" aria-label="우편번호" className={fieldInputClass} />
        </FormField>
        <FormField label="상세 주소" full hint="건물명, 층, 호수 등 구체적인 위치를 적어 주세요.">
          <input type="text" value={state.addressDetail} onChange={(event) => onFieldChange("addressDetail", event.target.value)} placeholder="예: 2층" aria-label="상세 주소" className={fieldInputClass} />
        </FormField>
      </div>

      {searchOpen && createPortal(
        <Modal label="도로명 주소 검색" onClose={() => setSearchOpen(false)} panelClassName="flex w-full max-w-xl flex-col gap-4 overflow-y-auto border border-line bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-title text-ink">주소 검색</h2>
            <button type="button" className="button button--outline" onClick={() => setSearchOpen(false)}>닫기</button>
          </div>
          {searchError && <p role="alert" className="text-sm text-coral">{searchError}</p>}
          {!scriptReady && !scriptError && <p role="status" className="text-sm text-soft">주소 검색을 불러오는 중…</p>}
          {scriptError && <p role="alert" className="text-sm text-coral">주소 검색을 불러오지 못했어요. 페이지를 새로고침한 뒤 다시 시도해 주세요.</p>}
          <div ref={embedRef} className="h-[55dvh] min-h-[400px] max-h-[520px] w-full border border-line" />
        </Modal>,
        document.body,
      )}
    </>
  );
}
