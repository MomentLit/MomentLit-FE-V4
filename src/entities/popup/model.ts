import type { AddressResponse } from "@/entities/space";

/** Verified against backend source (`PopupListResponse`/`PopupDetailResponse`). */
export interface PopupListItem {
  popup_id: number;
  title: string;
  address: AddressResponse;
  thumbnail_url: string | null;
  start_time: string;
  end_time: string;
  view_count: number;
  like_count: number;
}

export interface PopupDetail {
  popup_id: number;
  title: string;
  description: string;
  space_name: string;
  address: AddressResponse;
  thumbnail_url: string | null;
  view_count: number;
  like_count: number;
  ai_brand_summary: string | null;
  start_time: string;
  end_time: string;
  created_at: string;
}

/** Backend request fields are `String` for the time range (ISO datetime strings), not structured dates. */
export interface PopupCreateRequest {
  matching_id: number;
  title: string;
  description: string;
  thumbnail_url?: string;
  start_time: string;
  end_time: string;
}

export interface PopupCreateResponse {
  popup_id: number;
}
