import { apiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import { splitSpaceOptionName, type SpaceDetail } from "@/entities/space";
import type { AdminSpaceListItem } from "./model";

export async function fetchAdminSpaces(): Promise<AdminSpaceListItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ spaces: AdminSpaceListItem[] }>>("/admin/spaces");
  return data.data.spaces;
}

/**
 * 관리자가 남의 공간을 고칠 때 같은 공간의 다른 구역 id — `/spaces/me`는 관리자 본인 공간이라
 * 호스트의 구역을 못 찾으므로, 전체 목록에서 같은 호스트·이름 앞부분·도로명 주소로 찾는다.
 * 구역이 없는 공간이면 빈 배열.
 */
export async function fetchAdminSpaceSiblingIds(
  space: Pick<SpaceDetail, "space_id" | "host_id" | "name" | "address">,
): Promise<number[]> {
  const { baseName, optionLabel } = splitSpaceOptionName(space.name);
  if (!optionLabel) return [];
  const spaces = await fetchAdminSpaces();
  return spaces
    .filter(
      (candidate) =>
        candidate.spaceId !== space.space_id &&
        candidate.hostId === space.host_id &&
        splitSpaceOptionName(candidate.name).baseName === baseName &&
        candidate.address.roadAddress === space.address.road_address,
    )
    .map((candidate) => candidate.spaceId);
}

export async function approveAdminSpace(spaceId: number): Promise<void> {
  await apiClient.patch(`/admin/spaces/${spaceId}/approve`);
}

export async function rejectAdminSpace(spaceId: number): Promise<void> {
  await apiClient.patch(`/admin/spaces/${spaceId}/reject`);
}
