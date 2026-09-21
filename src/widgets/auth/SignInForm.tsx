"use client";

import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api";
import { Logo } from "@/shared/ui";
import { TextField } from "./TextField";
import { OAuthButton } from "./OAuthButton";

interface SignInFormProps {
  onSuccess: () => void;
  onSwitchToSignUp: () => void;
}

export function SignInForm({ onSuccess, onSwitchToSignUp }: SignInFormProps) {
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn({ email, password });
      onSuccess();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
      <Logo size={56} />

      <div className="flex w-full flex-col gap-4">
        <TextField
          label="이메일"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="example@momentlit.com"
          required
        />
        <TextField
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="비밀번호를 입력하세요"
          required
        />
      </div>

      {error && <p className="w-full text-left text-xs text-red-700">{error}</p>}

      <div className="flex w-full items-center justify-between text-xs text-gray-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" className="accent-primary-500" />
          로그인 상태 유지
        </label>
        <span>아이디 찾기 · 비밀번호 찾기</span>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-primary-500 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:bg-gray-300 disabled:shadow-none"
      >
        {isSubmitting ? "로그인 중" : "로그인"}
      </button>

      <div className="flex w-full items-center gap-2 text-xs whitespace-nowrap text-gray-600">
        <div className="h-px flex-1 bg-gray-200" />
        또는 간편 로그인
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="flex w-full flex-col gap-2">
        <OAuthButton provider="google" label="구글로 시작하기" />
        <OAuthButton provider="naver" label="네이버로 시작하기" />
        <OAuthButton provider="kakao" label="카카오로 시작하기" />
      </div>

      <p className="flex items-center gap-1 text-xs text-gray-600">
        아직 계정이 없으신가요?
        <button
          type="button"
          onClick={onSwitchToSignUp}
          className="font-medium text-primary-600 transition-colors duration-200 hover:text-primary-700 hover:underline"
        >
          회원가입
        </button>
      </p>
    </form>
  );
}
