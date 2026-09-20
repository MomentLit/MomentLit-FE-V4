import { apiClient } from "@/shared/api/client";
import type { ApiResponse } from "@/shared/api/types";
import type { ChatMessage, ChatRoomCreateRequest, ChatRoomCreateResponse, ChatRoomListItem } from "./model";

export async function createChatRoom(request: ChatRoomCreateRequest): Promise<ChatRoomCreateResponse> {
  const { data } = await apiClient.post<ApiResponse<ChatRoomCreateResponse>>("/chat", request);
  return data.data;
}

export async function fetchChatRooms(): Promise<ChatRoomListItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ chat_rooms: ChatRoomListItem[] }>>("/chat");
  return data.data.chat_rooms;
}

export async function fetchChatMessages(chatRoomId: number): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ApiResponse<{ chat_room_id: number; messages: ChatMessage[] }>>(
    `/chat/${chatRoomId}/messages`,
  );
  return data.data.messages;
}
