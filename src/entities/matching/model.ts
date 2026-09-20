/**
 * Mirrors the backend `matching` module DTOs exactly (verified against
 * source — see the field-by-field audit that preceded this file). Two odd
 * but confirmed quirks: the *request* sends `start_time`/`end_time`/
 * `total_price` as plain strings (not typed date/number), while every
 * *response* uses proper `LocalDateTime`/`Integer` on the wire.
 */
export type MatchingStatus = "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELED";

export interface MatchingCreateRequest {
  space_id: number;
  start_time: string;
  end_time: string;
  total_price: string;
  guest_count?: number;
}

export interface MatchingCreateResponse {
  matching_id: number;
  guest_count: number | null;
}

export interface MatchingSearchItem {
  matching_id: number;
  space_id: number;
  seller_id: string;
  host_id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  guest_count: number | null;
  status: MatchingStatus;
  created_at: string;
}

export interface HostStats {
  host_id: string;
  total_requested_count: number;
  processed_count: number;
  response_rate: number;
  avg_response_minutes: number | null;
}
