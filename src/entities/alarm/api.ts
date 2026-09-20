import { apiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { Alarm } from "./model";

export async function fetchAlarms(): Promise<Alarm[]> {
  const { data } = await apiClient.get<ApiResponse<Alarm[]>>("/alarm");
  return data.data;
}

export async function markAlarmRead(alarmId: number): Promise<void> {
  await apiClient.patch(`/alarm/${alarmId}`);
}
