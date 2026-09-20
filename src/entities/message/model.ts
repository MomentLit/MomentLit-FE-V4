/** Mirrors backend `chating` module DTOs — verified against source. */
export interface ChatRoomParty {
  id: string;
  name: string;
}

export interface ChatRoomSpaceRef {
  id: number;
  name: string;
}

export interface ChatRoomListItem {
  chat_room_id: number;
  space: ChatRoomSpaceRef;
  host: ChatRoomParty;
  seller: ChatRoomParty;
  created_at: string;
}

export interface ChatMessage {
  message_id: number;
  sender_id: string;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatRoomCreateRequest {
  space_id: number;
}

export interface ChatRoomCreateResponse {
  chat_room_id: number;
}
