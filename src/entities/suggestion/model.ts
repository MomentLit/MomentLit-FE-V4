export type SuggestionStatus = "PENDING" | "ANSWERED";

/** Mirrors `SuggestionResponse` — verified via a real authenticated call against the running backend. */
export interface Suggestion {
  suggestion_id: number;
  title: string;
  content: string;
  status: SuggestionStatus;
  answer_content: string | null;
  answered_at: string | null;
  created_at: string;
}

/** `GET/PATCH /admin/suggestions/**` — same shape plus the author's name. */
export interface AdminSuggestion extends Suggestion {
  user_name: string;
}

export interface SuggestionCreateRequest {
  title: string;
  content: string;
}
