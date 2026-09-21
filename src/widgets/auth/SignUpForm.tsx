"use client";

import { useState, type FormEvent } from "react";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api";
import { Logo } from "@/shared/ui";
import { TextField } from "./TextField";
import { OAuthButton } from "./OAuthButton";

interface SignUpFormProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export function SignUpForm({ onSuccess, onSwitchToSignIn }: SignUpFormProps) {
  const signUp = useAuthStore((state) => state.signUp);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [nickname, setNickname] = useState("");
  const [phone, setPhone] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const agreedAll = agreedTerms && agreedPrivacy;
  const canSubmit =
    agreedTerms &&
    agreedPrivacy &&
    password.length > 0 &&
    password === passwordConfirm;

  const toggleAll = (checked: boolean) => {
    setAgreedTerms(checked);
    setAgreedPrivacy(checked);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp({ email, password, name: nickname, phone });
      onSuccess();
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5">
      <Logo size={56} />

      <div className="flex w-full flex-col gap-3.5">
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
          placeholder="영문·숫자·특수문자 포함 8자 이상"
          required
        />
        <TextField
          label="비밀번호 확인"
          type="password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          placeholder="비밀번호를 다시 입력하세요"
          required
        />
        <TextField
          label="닉네임"
          type="text"
          value={nickname}
          onChange={setNickname}
          placeholder="2~12자로 입력하세요"
          required
        />
        <TextField
          label="휴대폰 번호"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="'-' 없이 숫자만 입력하세요"
          required
        />
      </div>

      {error && <p className="w-full text-left text-xs text-red-700">{error}</p>}

      <div className="flex w-full flex-col gap-2.5 rounded-xl border border-gray-200 bg-gray-50 p-3">
        <label className="flex items-center gap-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={agreedAll}
            onChange={(event) => toggleAll(event.target.checked)}
            className="accent-primary-500"
          />
          전체 동의합니다
        </label>
        <div className="h-px w-full bg-gray-200" />
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={agreedTerms}
            onChange={(event) => setAgreedTerms(event.target.checked)}
            className="accent-primary-500"
          />
          [필수] 이용약관 동의
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={agreedPrivacy}
            onChange={(event) => setAgreedPrivacy(event.target.checked)}
            className="accent-primary-500"
          />
          [필수] 개인정보 수집 및 이용 동의
        </label>
      </div>

      <button
        type="submit"
        disabled={!canSubmit || isSubmitting}
        className="w-full rounded-xl bg-primary-500 py-3 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-lg active:translate-y-0 disabled:pointer-events-none disabled:bg-gray-300 disabled:shadow-none"
      >
        {isSubmitting ? "가입 중" : "회원가입"}
      </button>

      <div className="flex w-full items-center gap-2 text-xs whitespace-nowrap text-gray-600">
        <div className="h-px flex-1 bg-gray-200" />
        또는 간편 가입
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <div className="flex w-full flex-col gap-2">
        <OAuthButton provider="google" label="구글로 시작하기" />
        <OAuthButton provider="naver" label="네이버로 시작하기" />
        <OAuthButton provider="kakao" label="카카오로 시작하기" />
      </div>

      <p className="flex items-center gap-1 text-xs text-gray-600">
        이미 계정이 있으신가요?
        <button
          type="button"
          onClick={onSwitchToSignIn}
          className="font-medium text-primary-600 transition-colors duration-200 hover:text-primary-700 hover:underline"
        >
          로그인
        </button>
      </p>
    </form>
  );
}
