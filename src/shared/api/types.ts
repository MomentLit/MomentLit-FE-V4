/** Common envelope shape the backend wraps most responses in. Adjust once the real API contract is confirmed. */
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

/** Placeholder for the eventual `Page<T>` response once the backend adds Pageable support (see ANALYSIS.md #4/#5). */
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}
