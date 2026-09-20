"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { useAuthStore } from "@/entities/auth";
import { approveAdminSpace, fetchAdminSpaces, rejectAdminSpace, type AdminSpaceListItem } from "@/entities/admin";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import type { SpaceAdminStatus } from "@/entities/space";
import { Badge, Card } from "@/shared/ui";
import { getErrorMessage } from "@/shared/api/error";
import { TONE_ON_BG } from "./tone-on-bg";

const STATUS_TABS: { key: SpaceAdminStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: "승인 대기" },
  { key: "APPROVED", label: "승인됨" },
  { key: "REJECTED", label: "거절됨" },
  { key: "DRAFT", label: "임시저장" },
];

const BADGE_VARIANT: Record<SpaceAdminStatus, "approved" | "pending" | "rejected" | "neutral"> = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  DRAFT: "neutral",
};

const BADGE_LABEL: Record<SpaceAdminStatus, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
  DRAFT: "임시저장",
};

function formatAddress(address: AdminSpaceListItem["address"]): string {
  return [address.sido, address.sigungu, address.eupMyeonDong].filter(Boolean).join(" ");
}

/**
 * 공간 승인/거절 관리자 화면 — `GET/PATCH /admin/spaces/**`(관리자 전용, 실제
 * curl로 필드명이 camelCase임을 확인함, 다른 API 대부분과 다름 — entities/admin
 * 참고)에 연동. 디자인 레퍼런스 8개 화면에는 없던 새 화면 — PENDING 상태 공간을
 * 승인하지 않으면 예약 요청이 전부 막히는 실제 운영상 필수 화면이라 추가했다.
 */
export function AdminSpaceList() {
  useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SpaceAdminStatus | "ALL">("PENDING");
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const spacesQuery = useQuery({
    queryKey: ["admin", "spaces"],
    queryFn: fetchAdminSpaces,
    enabled: isAdmin,
  });

  const approveMutation = useMutation({
    mutationFn: approveAdminSpace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "spaces"] }),
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  const rejectMutation = useMutation({
    mutationFn: rejectAdminSpace,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "spaces"] }),
    onError: (error) => setActionError(getErrorMessage(error)),
  });

  if (!hydrated) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center">
        <p className="text-sm text-soft">관리자 계정으로 로그인해야 볼 수 있는 화면이에요.</p>
      </div>
    );
  }

  const spaces = spacesQuery.data ?? [];
  const counts = spaces.reduce<Record<string, number>>((acc, space) => {
    acc[space.adminStatus] = (acc[space.adminStatus] ?? 0) + 1;
    return acc;
  }, {});
  const filtered = tab === "ALL" ? spaces : spaces.filter((space) => space.adminStatus === tab);

  return (
    <div className="flex-1 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">공간 승인 관리</h1>
      <p className="mt-1.5 text-sm text-soft">
        승인 대기 중인 공간을 검토하고 승인/거절합니다. 승인해야 예약 요청을 받을 수 있어요.
      </p>

      <div className="mt-6 flex gap-1 border-b border-line">
        {STATUS_TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`border-b-2 px-3.5 py-2.5 text-sm font-bold transition-colors ${
              tab === item.key ? "border-ink bg-primary-100 text-ink" : "border-transparent text-soft hover:text-ink"
            }`}
          >
            {item.label}
            <span className="ml-1.5 text-xs font-normal opacity-65">
              {item.key === "ALL" ? spaces.length : (counts[item.key] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      {actionError && <p className="mt-4 text-sm text-coral">{actionError}</p>}

      <div className="mt-5 flex flex-col gap-3">
        {spacesQuery.isPending && <p className="text-sm text-soft">불러오는 중…</p>}
        {spacesQuery.isError && (
          <p className="text-sm text-coral">목록을 불러오지 못했어요. {getErrorMessage(spacesQuery.error)}</p>
        )}
        {spacesQuery.isSuccess && filtered.length === 0 && (
          <p className="text-sm text-soft">해당하는 공간이 없어요.</p>
        )}

        {filtered.map((space) => (
          <Card key={space.spaceId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div
              className={`flex h-16 w-16 flex-none items-center justify-center text-[0.6rem] font-bold uppercase ${TONE_ON_BG[SPACE_CATEGORY_COLORS[space.category]]}`}
            >
              {SPACE_CATEGORY_LABELS[space.category]}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/spaces/${space.spaceId}`} className="font-bold text-ink hover:underline">
                  {space.name}
                </Link>
                <Badge variant={BADGE_VARIANT[space.adminStatus]}>{BADGE_LABEL[space.adminStatus]}</Badge>
              </div>
              <p className="mt-0.5 text-sm text-soft">{formatAddress(space.address)}</p>
              <p className="mt-0.5 font-mono text-xs text-soft">
                {space.pricePerHour.toLocaleString()}원 · 등록 {new Date(space.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>

            {space.adminStatus === "PENDING" && (
              <div className="flex flex-none gap-2">
                <button
                  type="button"
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  onClick={() => {
                    setActionError(null);
                    approveMutation.mutate(space.spaceId);
                  }}
                  className="bg-sky px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  승인
                </button>
                <button
                  type="button"
                  disabled={approveMutation.isPending || rejectMutation.isPending}
                  onClick={() => {
                    setActionError(null);
                    rejectMutation.mutate(space.spaceId);
                  }}
                  className="border border-ink px-4 py-2 text-sm font-bold text-ink transition-colors hover:bg-wash disabled:opacity-60"
                >
                  거절
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
