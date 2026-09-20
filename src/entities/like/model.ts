/** Mirrors `SpaceLikeResponse`/`PopupLikeResponse` — record field is `liked` but serializes as `is_liked`. */
export interface LikeStatus {
  like_count: number;
  is_liked: boolean;
}
