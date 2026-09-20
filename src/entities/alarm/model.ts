/**
 * Mirrors `AlarmResponse` — the alarm module has no `@JsonProperty` overrides
 * anywhere, so (unlike most of the backend) this serializes as plain camelCase.
 */
export interface Alarm {
  id: number;
  matchingId: number;
  description: string;
  isRead: boolean;
}
