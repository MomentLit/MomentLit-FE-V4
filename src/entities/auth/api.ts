import { apiClient, publicApiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type {
  MeResponse,
  RefreshResponse,
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
  UserUpdateRequest,
} from "./model";

export async function signIn(request: SignInRequest): Promise<SignInResponse> {
  const { data } = await publicApiClient.post<ApiResponse<SignInResponse>>("/auth/signin", request);
  return data.data;
}

export async function signUp(request: SignUpRequest): Promise<SignUpResponse> {
  const { data } = await publicApiClient.post<ApiResponse<SignUpResponse>>("/users/signup", request);
  return data.data;
}

export async function refreshTokens(refreshToken: string): Promise<RefreshResponse> {
  const { data } = await publicApiClient.post<ApiResponse<RefreshResponse>>("/auth/refresh", {
    refresh_token: refreshToken,
  });
  return data.data;
}

export async function signOut(refreshToken: string): Promise<void> {
  await apiClient.delete("/auth/signout", { data: { refresh_token: refreshToken } });
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await apiClient.get<ApiResponse<MeResponse>>("/users/me");
  return data.data;
}

export async function updateMe(request: UserUpdateRequest): Promise<void> {
  await apiClient.patch("/users/me", request);
}

/**
 * The backend never returns the user's own id on the wire (`GET /users/me`
 * omits it) — decode it from the JWT `sub` claim instead, same trick fe-v3
 * uses. Not signature-verified (that's the backend's job); this only reads
 * the payload to display/compare an id client-side.
 */
export function decodeUserIdFromToken(accessToken: string): string | null {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { sub?: string };
    return claims.sub ?? null;
  } catch {
    return null;
  }
}
