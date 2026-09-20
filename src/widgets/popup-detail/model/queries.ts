import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth";
import { fetchPopup } from "@/entities/popup/api";
import type { PopupDetail } from "@/entities/popup";
import { createPopupReview, fetchPopupReviews } from "@/entities/review";
import type { PopupReviewCreateRequest } from "@/entities/review";
import { fetchPopupLikeStatus, likePopup, unlikePopup } from "@/entities/like";
import type { LikeStatus } from "@/entities/like";

export function usePopupQuery(popupId: number) {
  return useQuery({
    queryKey: ["popup", popupId],
    queryFn: () => fetchPopup(popupId),
    retry: 1,
  });
}

export function usePopupReviewsQuery(popupId: number, enabled: boolean) {
  return useQuery({
    queryKey: ["popup-reviews", popupId],
    queryFn: () => fetchPopupReviews(popupId),
    enabled,
  });
}

export function useCreatePopupReviewMutation(popupId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: PopupReviewCreateRequest) => createPopupReview(popupId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["popup-reviews", popupId] }),
  });
}

export function usePopupLikeStatusQuery(popupId: number) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ["popup-like", popupId],
    queryFn: () => fetchPopupLikeStatus(popupId),
    enabled: isAuthenticated,
  });
}

export function useTogglePopupLikeMutation(popupId: number, isLiked: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => (isLiked ? unlikePopup(popupId) : likePopup(popupId)),
    onSuccess: (data: LikeStatus) => {
      queryClient.setQueryData(["popup-like", popupId], data);
      queryClient.setQueryData<PopupDetail | undefined>(["popup", popupId], (prev) =>
        prev ? { ...prev, like_count: data.like_count } : prev,
      );
    },
  });
}

export function computePopupReviewSummary(reviews: { rating: number }[]): { average: number; count: number } {
  if (reviews.length === 0) return { average: 0, count: 0 };
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return { average: total / reviews.length, count: reviews.length };
}
