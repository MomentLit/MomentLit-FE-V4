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
  /** 가격 문의 공간이면 `null`. */
  price_per_hour: number | null;
  price_inquiry?: boolean;
  category: string;
  address: string;
  usage_unit?: "HOURLY" | "DAILY" | null;
  /** 카드의 링크와 요금이 가리키는 구역. */
  option_label?: string | null;
  /** 이번 검색 조건에 맞는 구역 수. */
  option_count?: number;
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
