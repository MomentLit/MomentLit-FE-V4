/**
 * Mirrors the backend `User` entity — verified against the running backend
 * (new_BE). `id` is a UUID string (`@Id private String id`), never a number;
 * host vs. guest is resource ownership (hostId/sellerId match), not a role
 * field — `role` here is only ever USER/ADMIN.
 */
export interface User {
  id: string;
  email: string;
  name: string;
  imageUrl: string | null;
  role: "USER" | "ADMIN";
}
