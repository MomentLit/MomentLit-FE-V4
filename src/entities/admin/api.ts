import { apiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { AdminSpaceListItem } from "./model";

export async function fetchAdminSpaces(): Promise<AdminSpaceListItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ spaces: AdminSpaceListItem[] }>>("/admin/spaces");
  return data.data.spaces;
}

export async function approveAdminSpace(spaceId: number): Promise<void> {
  await apiClient.patch(`/admin/spaces/${spaceId}/approve`);
}

export async function rejectAdminSpace(spaceId: number): Promise<void> {
  await apiClient.patch(`/admin/spaces/${spaceId}/reject`);
}
