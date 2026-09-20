"use client";

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
    <section className="px-7 py-6">
      <div className="mb-3.5 flex items-center justify-between gap-3.5">
        <h2 className="text-xl font-bold tracking-tight text-ink">내 예약</h2>
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-soft">전체 보기</span>
      </div>

      {!hydrated ? (
        <div className="h-24 animate-pulse rounded-xl border border-line bg-wash" />
      ) : !isAuthenticated ? (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-line bg-wash px-4 py-6">
          <p className="text-sm text-soft">로그인하면 내 예약을 볼 수 있어요.</p>
          <button
            type="button"
            onClick={openAuthModal}
            className="rounded-md bg-sky px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white"
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
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="hidden grid-cols-[1fr_auto_auto] gap-4 bg-ink px-4 py-2 text-white sm:grid">
            <span className="text-[0.66rem] font-medium uppercase tracking-[0.18em]">공간</span>
            <span className="text-[0.66rem] font-medium uppercase tracking-[0.18em]">일시</span>
            <span className="text-[0.66rem] font-medium uppercase tracking-[0.18em]">상태</span>
          </div>
          {matchings.map((row, i) => {
            const meta = STATUS_META[row.status];
            const space = spaceById.get(row.space_id);
            return (
              <div
                key={row.matching_id}
                className="grid grid-cols-1 items-center gap-2 px-4 py-3.5 sm:grid-cols-[1fr_auto_auto] sm:gap-4"
                style={i < matchings.length - 1 ? { boxShadow: "inset 0 -1px 0 var(--line)" } : undefined}
              >
                <div className="flex min-w-0 flex-col">
                  <b className="text-sm font-bold tracking-tight text-ink">
                    {space?.name ?? `공간 #${row.space_id}`}
                  </b>
                  <span className="text-[0.78rem] text-soft">{space?.location ?? " "}</span>
                </div>
                <time className="whitespace-nowrap font-mono text-[0.74rem] tabular-nums text-ink">
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
