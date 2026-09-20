"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import {
  approveMatching,
  cancelMatching,
  fetchMatchingInbox,
  fetchMyMatchings,
  rejectMatching,
  type MatchingSearchItem,
  type MatchingStatus,
} from "@/entities/matching";
import { fetchSpace } from "@/entities/space/api";
import { Badge, type BadgeProps } from "@/shared/ui";
import { getErrorMessage } from "@/shared/api/error";
import { formatAddress, formatReservationDateTime } from "../lib/format";

type Tab = "received" | "sent";

const STATUS_META: Record<MatchingStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  REQUESTED: { label: "승인 대기", variant: "pending" },
  APPROVED: { label: "승인됨", variant: "approved" },
  REJECTED: { label: "거절됨", variant: "rejected" },
  CANCELED: { label: "취소됨", variant: "neutral" },
};

/**
 * 예약 요청함 — "받은 요청"(호스트로서 승인/거절, `GET /matchings/inbox` +
 * `PATCH .../approve|reject`)과 "보낸 요청"(게스트로서 내가 신청한 것,
 * `GET /matchings/me`, 취소 가능) 두 탭. 디자인 레퍼런스의 "내 예약" 테이블은
 * 보낸 요청만 보여줬는데, 실제로 예약이 성사되려면 호스트가 승인해야 하므로
 * 그 액션이 가능한 화면이 필요해서 추가했다.
 */
export function ReservationsView() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("received");
  const [actionError, setActionError] = useState<string | null>(null);

  const inboxQuery = useQuery({ queryKey: ["matchings", "inbox"], queryFn: fetchMatchingInbox, enabled: ready });
  const sentQuery = useQuery({ queryKey: ["matchings", "me"], queryFn: fetchMyMatchings, enabled: ready });

  const rows = tab === "received" ? (inboxQuery.data ?? []) : (sentQuery.data ?? []);
  const activeQuery = tab === "received" ? inboxQuery : sentQuery;

  const spaceIds = [...new Set(rows.map((row) => row.space_id))];
  const spaceQueries = useQueries({
    queries: spaceIds.map((id) => ({
      queryKey: ["spaces", "detail", id],
      queryFn: () => fetchSpace(id),
      staleTime: 60_000,
    })),
  });
  const spaceById = new Map<number, { name: string; location: string }>();
  spaceIds.forEach((id, i) => {
    const result = spaceQueries[i]?.data;
    if (result) spaceById.set(id, { name: result.name, location: formatAddress(result.address) });
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["matchings", "inbox"] });
    queryClient.invalidateQueries({ queryKey: ["matchings", "me"] });
  }

  const approveMut = useMutation({
    mutationFn: approveMatching,
    onSuccess: invalidateAll,
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const rejectMut = useMutation({
    mutationFn: rejectMatching,
    onSuccess: invalidateAll,
    onError: (error) => setActionError(getErrorMessage(error)),
  });
  const cancelMut = useMutation({
    mutationFn: cancelMatching,
    onSuccess: invalidateAll,
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const busy = approveMut.isPending || rejectMut.isPending || cancelMut.isPending;

  if (!ready) {
    return (
      <div className="flex-1 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">예약</h1>
        <p className="mt-3 text-sm text-soft">로그인이 필요한 서비스입니다.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">예약</h1>
      <p className="mt-1.5 text-sm text-soft">
        받은 예약 요청을 승인/거절하거나, 내가 보낸 요청의 진행 상황을 확인합니다.
      </p>

      <div className="mt-6 flex gap-1 border-b border-line">
        {(
          [
            ["received", "받은 요청"],
            ["sent", "보낸 요청"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key);
              setActionError(null);
            }}
            className={`border-b-2 px-3.5 py-2.5 text-sm font-bold transition-colors ${
              tab === key ? "border-ink bg-primary-100 text-ink" : "border-transparent text-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {actionError && <p className="mt-4 text-sm text-coral">{actionError}</p>}

      <div className="mt-5 flex flex-col gap-3">
        {activeQuery.isPending && <p className="text-sm text-soft">불러오는 중…</p>}
        {activeQuery.isError && (
          <p className="text-sm text-coral">불러오지 못했어요. {getErrorMessage(activeQuery.error)}</p>
        )}
        {activeQuery.isSuccess && rows.length === 0 && (
          <p className="text-sm text-soft">
            {tab === "received" ? "받은 예약 요청이 없어요." : "보낸 예약 요청이 없어요."}
          </p>
        )}

        {rows.map((row: MatchingSearchItem) => {
          const meta = STATUS_META[row.status];
          const space = spaceById.get(row.space_id);
          return (
            <div
              key={row.matching_id}
              className="flex flex-col gap-3 border border-line bg-white p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="font-bold text-ink">{space?.name ?? `공간 #${row.space_id}`}</b>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <p className="mt-0.5 text-sm text-soft">{space?.location ?? " "}</p>
                <p className="mt-0.5 font-mono text-xs text-soft">
                  {formatReservationDateTime(row.start_time, row.end_time)} · {row.guest_count ?? "-"}인 ·{" "}
                  {row.total_price.toLocaleString()}원
                </p>
              </div>

              {tab === "received" && row.status === "REQUESTED" && (
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setActionError(null);
                      approveMut.mutate(row.matching_id);
                    }}
                    className="bg-sky px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setActionError(null);
                      rejectMut.mutate(row.matching_id);
                    }}
                    className="border border-ink px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-wash disabled:opacity-60"
                  >
                    거절
                  </button>
                </div>
              )}

              {tab === "sent" && row.status === "REQUESTED" && (
                <div className="flex flex-none gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setActionError(null);
                      cancelMut.mutate(row.matching_id);
                    }}
                    className="border border-ink px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-wash disabled:opacity-60"
                  >
                    요청 취소
                  </button>
                </div>
              )}

              {tab === "sent" && row.status === "APPROVED" && (
                <div className="flex flex-none gap-2">
                  <Link
                    href={`/popups/new?matchingId=${row.matching_id}`}
                    className="bg-sky px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90"
                  >
                    팝업 만들기
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
