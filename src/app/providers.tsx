"use client";

import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/entities/auth";

/**
 * Clears every cached query on login/logout/account switch. Without this,
 * per-user data (matchings, chat rooms, favorites, ...) keeps whatever the
 * *previous* session's queries resolved to under the same query keys —
 * caught live: switching from a guest account to the space's host account
 * on `/reservations` kept showing the guest's empty "받은 요청" result
 * instead of refetching for the new user.
 *
 * Gated on `hydrated` (not just "first effect run"): `hydrate()` resolves
 * asynchronously, so `userId` goes `undefined -> <id>` a beat *after* mount
 * on every page load where a token already exists in localStorage — that's
 * not a real account switch. Clearing then raced other components' already
 * in-flight queries (space/reviews/availability, dispatched immediately on
 * mount, not gated on auth) and left some of them stuck on `fetchStatus:
 * "fetching"` forever, even though the underlying HTTP request had already
 * completed — caught live on `/spaces/[id]`'s review list. Waiting for
 * `hydrated` and treating that first post-hydration value as the baseline
 * (not a switch) avoids clearing mid-flight for queries that never touch
 * auth at all.
 */
function AuthCacheSync() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id);
  const hydrated = useAuthStore((state) => state.hydrated);
  const previousUserId = useRef<string | undefined>(undefined);
  const hasBaseline = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!hasBaseline.current) {
      hasBaseline.current = true;
      previousUserId.current = userId;
      return;
    }
    if (previousUserId.current !== userId) {
      previousUserId.current = userId;
      queryClient.clear();
    }
  }, [hydrated, userId, queryClient]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
  }));

  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthCacheSync />
      {children}
    </QueryClientProvider>
  );
}
