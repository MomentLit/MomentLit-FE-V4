"use client";

import { create } from "zustand";
import { setAuthFailureHandler } from "@/shared/api/client";
import {
  decodeUserIdFromToken,
  fetchMe,
  refreshTokens,
  signIn as signInRequest,
  signOut as signOutRequest,
  signUp as signUpRequest,
} from "./api";
import type { AuthUser, SignInRequest, SignUpRequest } from "./model";

const ACCESS_TOKEN_KEY = "momentlit_access_token";
const REFRESH_TOKEN_KEY = "momentlit_refresh_token";

function readToken(key: string): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(key);
  return value && value !== "null" && value !== "undefined" ? value : null;
}

function writeTokens(accessToken: string, refreshToken: string) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

interface AuthState {
  /** False until the first client-side check of localStorage finishes — avoids an SSR/CSR flash. */
  hydrated: boolean;
  isAuthenticated: boolean;
  user: AuthUser | null;
  isAuthModalOpen: boolean;
  signIn: (request: SignInRequest) => Promise<void>;
  signUp: (request: SignUpRequest) => Promise<void>;
  signOut: () => Promise<void>;
  /** OAuth 콜백 페이지에서 호출 — 백엔드가 리다이렉트로 넘겨준 토큰 쌍으로 일반 로그인과 동일하게 세션을 완성한다. */
  completeOauthLogin: (accessToken: string, refreshToken: string) => Promise<void>;
  hydrate: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
}

async function loadUser(accessToken: string): Promise<AuthUser> {
  const me = await fetchMe();
  return {
    id: decodeUserIdFromToken(accessToken) ?? "",
    email: me.email,
    name: me.name,
    role: me.role,
    imageUrl: me.image_url,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  hydrated: false,
  isAuthenticated: false,
  user: null,
  isAuthModalOpen: false,

  async signIn(request) {
    const response = await signInRequest(request);
    writeTokens(response.access_token, response.refresh_token);
    const user = await loadUser(response.access_token);
    set({ isAuthenticated: true, user, isAuthModalOpen: false });
  },

  async signUp(request) {
    await signUpRequest(request);
    await get().signIn({ email: request.email, password: request.password });
  },

  async completeOauthLogin(accessToken, refreshToken) {
    writeTokens(accessToken, refreshToken);
    const user = await loadUser(accessToken);
    set({ isAuthenticated: true, user, isAuthModalOpen: false });
  },

  async signOut() {
    const refreshToken = readToken(REFRESH_TOKEN_KEY);
    clearTokens();
    set({ isAuthenticated: false, user: null });
    if (refreshToken) {
      try {
        await signOutRequest(refreshToken);
      } catch {
        // Already logged out client-side regardless of whether the server call succeeds.
      }
    }
  },

  async hydrate() {
    const accessToken = readToken(ACCESS_TOKEN_KEY);
    if (!accessToken) {
      // 다른 탭에서 로그아웃되어 토큰이 사라진 뒤 이 탭에서 다시 호출되는 경우도 있으므로,
      // 이미 남아있는 isAuthenticated/user를 반드시 같이 초기화해야 한다.
      set({ hydrated: true, isAuthenticated: false, user: null });
      return;
    }
    try {
      const user = await loadUser(accessToken);
      set({ isAuthenticated: true, user, hydrated: true });
    } catch {
      clearTokens();
      set({ isAuthenticated: false, user: null, hydrated: true });
    }
  },

  openAuthModal() {
    set({ isAuthModalOpen: true });
  },

  closeAuthModal() {
    set({ isAuthModalOpen: false });
  },
}));

/** Wired once from the root layout: on 401/403, try a refresh; on failure, log out and prompt sign-in. */
setAuthFailureHandler(async () => {
  const refreshToken = readToken(REFRESH_TOKEN_KEY);
  if (!refreshToken) return false;

  try {
    const response = await refreshTokens(refreshToken);
    writeTokens(response.access_token, response.refresh_token);
    const user = await loadUser(response.access_token);
    useAuthStore.setState({ isAuthenticated: true, user });
    return true;
  } catch {
    clearTokens();
    useAuthStore.setState({ isAuthenticated: false, user: null });
    return false;
  }
});

/**
 * 다른 탭에서 로그인/로그아웃해 토큰이 바뀌면 `storage` 이벤트가 이 탭에도 온다(같은 origin의
 * localStorage는 탭 간에 공유되므로 — 이 자체는 정상 동작). 문제는 이 탭의 화면 상태(사이드바
 * 유저명 등)가 그걸 반영 안 하면 "화면은 A, 실제 요청은 B"로 어긋나 리소스가 엉뚱한 계정에
 * 귀속될 수 있다는 것 — 그래서 감지 즉시 `hydrate()`로 화면을 실제 토큰 기준으로 재동기화한다.
 */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== ACCESS_TOKEN_KEY && event.key !== REFRESH_TOKEN_KEY) return;
    useAuthStore.getState().hydrate();
  });
}
