import type { SpaceCategory } from "@/entities/space-category";
import type { SpaceAdminStatus, UsageUnit } from "@/entities/space";

/**
 * `/admin/spaces/**` DTOs — verified via a real authenticated curl call, not
 * guessed from source. Unlike every other endpoint in this backend (which
 * uses snake_case via explicit `@JsonProperty`), the admin module's DTOs
 * have no such annotations, so these serialize as plain camelCase. The
 * nested address also has no `region` field here (the admin module keeps
 * its own separate `AddressResponse` copy that predates the region column).
 */
export interface AdminAddress {
  sido: string;
  sigungu: string;
  eupMyeonDong: string;
  roadAddress: string;
  jibunAddress: string | null;
  detailAddress: string | null;
  postalCode: string;
}

export interface AdminSpaceListItem {
  spaceId: number;
  hostId: string;
  name: string;
  description: string;
  aiSummary: string | null;
  address: AdminAddress;
  thumbnailUrl: string | null;
  pricePerHour: number;
  adminStatus: SpaceAdminStatus;
  isActive: boolean;
  category: SpaceCategory;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  area: number | null;
  capacity: number | null;
  floor: string | null;
  parkingInfo: string | null;
  usageUnit: UsageUnit | null;
}
