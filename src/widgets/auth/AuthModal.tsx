"use client";

import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api/error";

type Tab = "signin" | "signup";
type OauthProvider = "google" | "kakao" | "naver";

const inputClass =
  "w-full rounded-md border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-soft focus:border-sky";

const OAUTH_PROVIDERS: { key: OauthProvider; label: string }[] = [
  { key: "google", label: "Google로 계속하기" },
  { key: "kakao", label: "카카오로 계속하기" },
  { key: "naver", label: "네이버로 계속하기" },
];

/**
 * OAuth는 팝업이 아니라 전체 페이지 리다이렉트다 — provider 로그인 화면 자체가 팝업/iframe 임베드를
 * 막기 때문. `/auth/oauth/{provider}`는 302로 provider 인증 화면으로 보내고, provider는 각 콘솔에
 * 등록된 백엔드의 콜백 URL로 돌아오며, 백엔드가 다시 `/auth/callback`(이 앱)으로 토큰을 실어 보낸다.
 */
function startOauthLogin(provider: OauthProvider) {
  // Cross-origin full-page redirect to the backend (not an internal Next.js route) — router.push can't do this.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/oauth/${provider}`;
}

/**
 * Global auth modal — mounted once from the root layout, opened from
 * anywhere via `useAuthStore().openAuthModal()` (same pattern fe-v3 uses,
 * see ANALYSIS.md §2 frontend notes). No design-reference screen for this
 * exists, so it's a plain on-brand form: ink text on white, sky primary
 * button, no category-color styling (this isn't "content").
 */
export function AuthModal() {
  const isOpen = useAuthStore((state) => state.isAuthModalOpen);
  const close = useAuthStore((state) => state.closeAuthModal);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const resetFields = () => {
    setEmail("");
    setPassword("");
    setName("");
    setPhone("");
    setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (tab === "signin") {
        await signIn({ email, password });
      } else {
        await signUp({ email, password, name, phone });
      }
      resetFields();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={close}
    >
      <div
        className="w-full max-w-[380px] rounded-2xl border border-line bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex gap-1 rounded-lg bg-wash p-1">
          {(["signin", "signup"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTab(value);
                setError(null);
              }}
              className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
                tab === value ? "bg-white text-ink shadow-sm" : "text-soft"
              }`}
            >
              {value === "signin" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            placeholder="이메일"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            autoComplete="email"
          />
          {tab === "signup" && (
            <>
              <input
                type="text"
                required
                placeholder="이름"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                autoComplete="name"
              />
              <input
                type="tel"
                required
                placeholder="전화번호 (01012345678)"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={inputClass}
                autoComplete="tel"
              />
            </>
          )}
          <input
            type="password"
            required
            placeholder="비밀번호"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            autoComplete={tab === "signin" ? "current-password" : "new-password"}
          />

          {error && <p className="text-sm text-coral">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-md bg-sky px-4 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white disabled:opacity-60"
          >
            {submitting ? "처리 중…" : tab === "signin" ? "로그인" : "회원가입"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-2.5 text-xs text-soft">
          <div className="h-px flex-1 bg-line" />
          또는
          <div className="h-px flex-1 bg-line" />
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {OAUTH_PROVIDERS.map((provider) => (
            <button
              key={provider.key}
              type="button"
              onClick={() => startOauthLogin(provider.key)}
              className="w-full border border-line bg-white py-2.5 text-sm font-bold text-ink transition-colors hover:bg-wash"
            >
              {provider.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-4 w-full text-center text-xs text-soft hover:text-ink"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
