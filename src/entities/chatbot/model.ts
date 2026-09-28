/** `POST /chat/stream` request body. `conversation_id` is supplied after the first reply. */
export interface ChatbotStreamRequest {
  message: string;
  conversation_id?: string;
}

/** A recommended space sent by the `space_cards` SSE event. */
export interface ChatbotSpaceCard {
  id: number;
  name: string;
  thumbnail_url: string | null;
  price_per_hour: number;
  category: string;
  address: string;
}

export interface ChatbotDone {
  text: string;
  space_ids: number[];
}

export type ChatbotStreamEvent =
  | { type: "conversation"; conversationId: string }
  | { type: "space_cards"; spaces: ChatbotSpaceCard[] }
  | { type: "delta"; text: string }
  | { type: "done"; result: ChatbotDone };
