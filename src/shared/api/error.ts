import axios, { type AxiosError } from "axios";

/** True when `error` is an axios error carrying an HTTP response (as opposed to a network/timeout failure). */
export function isApiError(error: unknown): error is AxiosError {
  return axios.isAxiosError(error) && Boolean(error.response);
}

/**
 * Every backend error response is prefixed `[ERROR: Domain/Code] `
 * (verified across every error this app has hit — 404s, 409s, 500s alike) —
 * an internal error code, not something a user should see. Strip it so
 * `"[ERROR: User/Phone/Duplicate] 이미 존재하는 전화번호"` reads as just
 * `"이미 존재하는 전화번호"`.
 */
function stripErrorCodePrefix(message: string): string {
  return message.replace(/^\[ERROR:[^\]]*\]\s*/, "");
}

/**
 * Fallback for when the backend response has no `message` field at all (a raw
 * 401/403/404/5xx with no body) — otherwise the axios default ("Request failed
 * with status code 403") leaks straight to the screen.
 */
function fallbackMessageForStatus(status: number | undefined, axiosMessage: string): string {
  if (status === 401 || status === 403) return "로그인이 필요해요.";
  if (status === 404) return "요청한 내용을 찾을 수 없어요.";
  if (status !== undefined && status >= 500) return "서버에 문제가 발생했어요. 잠시 후 다시 시도해 주세요.";
  return axiosMessage;
}

/** Best-effort extraction of a human-readable message from an unknown thrown value. */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (message) return stripErrorCodePrefix(message);
    return fallbackMessageForStatus(error.response?.status, error.message);
  }

  if (error instanceof Error) return error.message;

  return "알 수 없는 오류가 발생했습니다.";
}
