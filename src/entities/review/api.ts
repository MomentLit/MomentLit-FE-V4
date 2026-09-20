import { apiClient, publicApiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { PopupReview, PopupReviewCreateRequest, SpaceReview, SpaceReviewCreateRequest } from "./model";

export async function fetchSpaceReviews(spaceId: number): Promise<SpaceReview[]> {
  const { data } = await publicApiClient.get<ApiResponse<{ reviews: SpaceReview[] }>>(`/spaces/${spaceId}/reviews`);
  return data.data.reviews;
}

/** Space reviews are tied to a completed matching, not the space directly. */
export async function createSpaceReview(matchingId: number, request: SpaceReviewCreateRequest): Promise<void> {
  await apiClient.post(`/matchings/${matchingId}/reviews`, request);
}

export async function fetchPopupReviews(popupId: number): Promise<PopupReview[]> {
  const { data } = await publicApiClient.get<ApiResponse<{ reviews: PopupReview[] }>>(`/popups/${popupId}/reviews`);
  return data.data.reviews;
}

export async function createPopupReview(popupId: number, request: PopupReviewCreateRequest): Promise<void> {
  await apiClient.post(`/popups/${popupId}/reviews`, request);
}
