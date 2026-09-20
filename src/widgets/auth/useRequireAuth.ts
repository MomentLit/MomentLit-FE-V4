"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/entities/auth";

/**
 * Gate for pages that need a logged-in user (registration, messages,
 * reservations, ...). Opens the global auth modal instead of redirecting —
 * same UX fe-v3 uses — so the user can sign in without losing their place.
 */
export function useRequireAuth() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      openAuthModal();
    }
  }, [hydrated, isAuthenticated, openAuthModal]);

  return { ready: hydrated && isAuthenticated };
}
