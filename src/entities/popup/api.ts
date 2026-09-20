import { publicApiClient, apiClient } from "@/shared/api/client";
import type { ApiResponse, PageResponse } from "@/shared/api/types";
import type { PopupCreateRequest, PopupCreateResponse, PopupDetail, PopupListItem } from "./model";

export async function createPopup(request: PopupCreateRequest): Promise<PopupCreateResponse> {
  const { data } = await apiClient.post<ApiResponse<PopupCreateResponse>>("/popups", request);
  return data.data;
}

export async function fetchPopups(params: { page?: number; size?: number } = {}): Promise<
  PageResponse<PopupListItem>
> {
  const { data } = await publicApiClient.get<ApiResponse<PageResponse<PopupListItem>>>("/popups", { params });
  return data.data;
}

/**
 * Fixed Top-10 by likeCount/viewCount/createdAt — no pagination params
 * (backend uses a derived-query finder, not Pageable, so the response is
 * still the old `{ popups: [...] }` wrapper, unlike `GET /popups`).
 */
export async function fetchRecommendedPopups(): Promise<PopupListItem[]> {
  const { data } = await publicApiClient.get<ApiResponse<{ popups: PopupListItem[] }>>("/popups/recommendations");
  return data.data.popups;
}

export async function fetchPopup(popupId: number): Promise<PopupDetail> {
  const { data } = await publicApiClient.get<ApiResponse<PopupDetail>>(`/popups/${popupId}`);
  return data.data;
}

/** Also the old `{ popups: [...] }` wrapper — left un-paginated by design (see fetchRecommendedPopups). */
export async function fetchMyPopups(): Promise<PopupListItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ popups: PopupListItem[] }>>("/popups/me");
  return data.data.popups;
}
