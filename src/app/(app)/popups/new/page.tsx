import type { Metadata } from "next";
import { Suspense } from "react";
import { PopupRegistrationForm } from "@/widgets/popup-registration";

export const metadata: Metadata = { title: "팝업 등록" };

export default function PopupRegistrationPage() {
  return (
    <Suspense fallback={<div className="flex-1 p-10 text-sm text-soft">불러오는 중…</div>}>
      <PopupRegistrationForm />
    </Suspense>
  );
}
