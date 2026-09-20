"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/entities/auth";
import { getErrorMessage } from "@/shared/api/error";

/**
 * OAuth redirect-uri는 프론트가 아니라 백엔드(`/auth/oauth/{provider}/callback`)를 직접 가리키므로
 * (각 provider 콘솔에 등록된 값이라 바꿀 수 없다), 백엔드가 토큰 발급 후 여기로 다시 리다이렉트해준다.
 * 쿼리 파라미터의 토큰을 읽어 일반 로그인과 동일한 방식으로 세션을 완성한다.
 */
function OauthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const completeOauthLogin = useAuthStore((state) => state.completeOauthLogin);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const accessToken = searchParams.get("access_token");
    const refreshToken = searchParams.get("refresh_token");

    if (!accessToken || !refreshToken) {
      queueMicrotask(() => setError("로그인 정보를 받아오지 못했어요."));
      return;
    }

    completeOauthLogin(accessToken, refreshToken)
      .then(() => router.replace("/home"))
      .catch((loginError) => setError(getErrorMessage(loginError)));
  }, [searchParams, completeOauthLogin, router]);

  return (
    <div className="flex flex-1 items-center justify-center p-10 text-center">
      {error ? (
        <div>
          <p className="text-sm text-coral">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/home")}
            className="mt-3 text-sm font-bold text-ink underline"
          >
            홈으로 돌아가기
          </button>
        </div>
      ) : (
        <p className="text-sm text-soft">로그인 처리 중…</p>
      )}
    </div>
  );
}

export default function OauthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex flex-1 items-center justify-center p-10 text-sm text-soft">로그인 처리 중…</div>}>
      <OauthCallbackContent />
    </Suspense>
  );
}
