import { apiClient, publicApiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { HostStats, MatchingCreateRequest, MatchingCreateResponse, MatchingSearchItem } from "./model";

export async function createMatching(request: MatchingCreateRequest): Promise<MatchingCreateResponse> {
  const { data } = await apiClient.post<ApiResponse<MatchingCreateResponse>>("/matchings", request);
  return data.data;
}

/** Requests sent *to* me as a host, awaiting my approve/reject. */
export async function fetchMatchingInbox(): Promise<MatchingSearchItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ matchings: MatchingSearchItem[] }>>("/matchings/inbox");
  return data.data.matchings;
}

/** Requests I sent as a seller/guest. */
export async function fetchMyMatchings(): Promise<MatchingSearchItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ matchings: MatchingSearchItem[] }>>("/matchings/me");
  return data.data.matchings;
}

export async function approveMatching(matchingId: number): Promise<void> {
  await apiClient.patch(`/matchings/${matchingId}/approve`);
}

export async function rejectMatching(matchingId: number): Promise<void> {
  await apiClient.patch(`/matchings/${matchingId}/reject`);
}

export async function cancelMatching(matchingId: number): Promise<void> {
  await apiClient.patch(`/matchings/${matchingId}/cancel`);
}

export async function fetchHostStats(hostId: string): Promise<HostStats> {
  const { data } = await publicApiClient.get<ApiResponse<HostStats>>(`/matchings/host-stats/${hostId}`);
  return data.data;
}
