"use client";

import Link from "next/link";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Badge, type BadgeProps } from "@/shared/ui";
import { useAuthStore } from "@/entities/auth";
import { fetchMyMatchings, type MatchingStatus } from "@/entities/matching";
import { fetchSpace } from "@/entities/space/api";
import { getErrorMessage } from "@/shared/api/error";
import { formatAddress, formatReservationDateTime } from "../lib/format";

const STATUS_META: Record<MatchingStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  REQUESTED: { label: "승인 대기", variant: "pending" },
  APPROVED: { label: "승인됨", variant: "approved" },
  REJECTED: { label: "거절됨", variant: "rejected" },
  CANCELED: { label: "취소됨", variant: "neutral" },
};

/**
 * "내 예약" — real `GET /matchings/me`. Logged-out visitors never trigger the
 * request; they just see a sign-in nudge (this widget doesn't gate the whole
 * page, unlike `useRequireAuth`-protected routes).
 */
export function MyReservationsTable() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const openAuthModal = useAuthStore((state) => state.openAuthModal);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["matchings", "me"],
    queryFn: fetchMyMatchings,
    enabled: hydrated && isAuthenticated,
  });

  const matchings = data ?? [];
  const spaceIds = [...new Set(matchings.map((m) => m.space_id))];

  // Matching rows only carry `space_id` — look up each space once to show its name/location.
  const spaceQueries = useQueries({
    queries: spaceIds.map((id) => ({
      queryKey: ["spaces", "detail", id],
      queryFn: () => fetchSpace(id),
      enabled: hydrated && isAuthenticated,
      staleTime: 60_000,
    })),
  });

  const spaceById = new Map<number, { name: string; location: string }>();
  spaceIds.forEach((id, i) => {
    const result = spaceQueries[i]?.data;
    if (result) {
      spaceById.set(id, { name: result.name, location: formatAddress(result.address) });
    }
  });

  return (
    <section className="app-gutter py-8 sm:py-10">
      <div className="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 className="section-title text-ink">내 예약</h2>
        <Link href="/reservations" className="shrink-0 whitespace-nowrap text-sm font-semibold text-ink/75 transition-colors hover:text-ink hover:underline underline-offset-4 sm:text-base">전체 보기 →</Link>
      </div>

      {!hydrated ? (
        <div className="h-24 animate-pulse rounded-xl border border-line bg-wash" />
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-wash px-4 py-6">
          <p className="text-sm text-soft">로그인하면 내 예약을 볼 수 있어요.</p>
          <button
            type="button"
            onClick={openAuthModal}
            className="button button--primary"
          >
            로그인 / 회원가입
          </button>
        </div>
      ) : isLoading ? (
        <div className="h-24 animate-pulse rounded-xl border border-line bg-wash" />
      ) : isError ? (
        <p className="py-6 text-sm text-soft">예약 정보를 불러오지 못했어요. {getErrorMessage(error)}</p>
      ) : matchings.length === 0 ? (
        <p className="py-6 text-sm text-soft">아직 예약 내역이 없어요.</p>
      ) : (
        <div className="collection-grid">
          {matchings.map((row) => {
            const meta = STATUS_META[row.status];
            const space = spaceById.get(row.space_id);
            return (
              <div
                key={row.matching_id}
                className="interactive-card flex flex-col items-start gap-3 border border-line bg-white p-5"
              >
                <div className="flex min-w-0 flex-col">
                  <Link href={`/spaces/${row.space_id}`} className="text-lg font-bold tracking-tight text-ink hover:underline">
                    {space?.name ?? `공간 #${row.space_id}`}
                  </Link>
                  <span className="text-[0.78rem] text-soft">{space?.location ?? " "}</span>
                </div>
                <time className="font-mono text-[0.74rem] tabular-nums text-ink">
                  {formatReservationDateTime(row.start_time, row.end_time)}
                </time>
                <Badge variant={meta.variant} className="w-fit">
                  {meta.label}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
