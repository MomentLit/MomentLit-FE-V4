/**
 * Auth request/response shapes — verified against the real running backend
 * (new_BE, `POST /auth/signin`, `POST /users/signup`, `POST /auth/refresh`,
 * `DELETE /auth/signout`, `GET /users/me`), not guessed from source alone.
 * The backend's Jackson naming strategy is inconsistent (some fields are
 * snake_case via `@JsonProperty`, some are plain), so these mirror the exact
 * wire shape rather than a single convention.
 */

export interface SignInRequest {
  email: string;
  password: string;
}

export interface SignInResponse {
  name: string;
  role: "USER" | "ADMIN";
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SignUpRequest {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface SignUpResponse {
  user_id: string;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * `GET /users/me` — note: no user id field on the wire; decode it from the JWT `sub` claim instead.
 * `phone` is nullable despite looking mandatory in the signup form — OAuth signup (`User.createOauth`)
 * never sets it, so a Google/Kakao/Naver-only account has `phone: null` on the wire.
 */
export interface MeResponse {
  image_url: string | null;
  email: string;
  name: string;
  phone: string | null;
  intro: string | null;
  role: "USER" | "ADMIN";
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  imageUrl: string | null;
}

/** `PATCH /users/me` — partial update, only send the fields that changed. */
export interface UserUpdateRequest {
  name?: string;
  image_url?: string;
  phone?: string;
  intro?: string;
}
