/**
 * Mirrors backend `review` module DTOs — verified against source. Note the
 * inconsistencies (kept as-is; they're the real wire format, not a typo
 * here): the create-request DTOs have **no** snake_case conversion at all,
 * and space vs. popup review responses use different keys for the same
 * concept (`likes_count` vs `like_count`).
 */
export interface SpaceReviewCreateRequest {
  rating: number;
  content: string;
}

export interface SpaceReview {
  space_review_id: number;
  user_name: string;
  rating: number;
  content: string;
  likes_count: number;
  created_at: string;
}

export type VerificationType = "QR" | "RECEIPT";

export interface PopupReviewCreateRequest {
  rating: number;
  content: string;
  verificationType: VerificationType;
  verificationPayload: string;
}

export interface PopupReview {
  popup_review_id: number;
  user_name: string;
  rating: number;
  content: string;
  verification_type: VerificationType;
  is_verified: boolean;
  like_count: number;
  created_at: string;
}
