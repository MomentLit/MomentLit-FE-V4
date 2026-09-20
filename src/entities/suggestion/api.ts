import { apiClient } from "@/shared/api/client";
import type { ApiResponse, PageResponse } from "@/shared/api/types";
import type { AdminSuggestion, Suggestion, SuggestionCreateRequest } from "./model";

export async function createSuggestion(request: SuggestionCreateRequest): Promise<Suggestion> {
  const { data } = await apiClient.post<ApiResponse<Suggestion>>("/suggestions", request);
  return data.data;
}

export async function fetchMySuggestions(): Promise<PageResponse<Suggestion>> {
  const { data } = await apiClient.get<ApiResponse<PageResponse<Suggestion>>>("/suggestions/me");
  return data.data;
}

export async function fetchAdminSuggestions(): Promise<PageResponse<AdminSuggestion>> {
  const { data } = await apiClient.get<ApiResponse<PageResponse<AdminSuggestion>>>("/admin/suggestions");
  return data.data;
}

export async function answerSuggestion(suggestionId: number, answerContent: string): Promise<AdminSuggestion> {
  const { data } = await apiClient.patch<ApiResponse<AdminSuggestion>>(`/admin/suggestions/${suggestionId}/answer`, {
    answer_content: answerContent,
  });
  return data.data;
}
