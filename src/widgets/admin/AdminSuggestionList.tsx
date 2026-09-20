"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { useAuthStore } from "@/entities/auth";
import { answerSuggestion, fetchAdminSuggestions, type SuggestionStatus } from "@/entities/suggestion";
import { Badge, Card } from "@/shared/ui";
import { getErrorMessage } from "@/shared/api/error";

const STATUS_TABS: { key: SuggestionStatus | "ALL"; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "PENDING", label: "답변 대기" },
  { key: "ANSWERED", label: "답변 완료" },
];

const STATUS_META: Record<SuggestionStatus, { label: string; variant: "pending" | "approved" }> = {
  PENDING: { label: "답변 대기", variant: "pending" },
  ANSWERED: { label: "답변 완료", variant: "approved" },
};

/** 건의 답변 관리자 화면 — `GET /admin/suggestions` + `PATCH /admin/suggestions/{id}/answer` (관리자 전용). */
export function AdminSuggestionList() {
  useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SuggestionStatus | "ALL">("PENDING");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const suggestionsQuery = useQuery({
    queryKey: ["admin", "suggestions"],
    queryFn: fetchAdminSuggestions,
    enabled: isAdmin,
  });

  const answerMutation = useMutation({
    mutationFn: ({ id, answerContent }: { id: number; answerContent: string }) => answerSuggestion(id, answerContent),
    onSuccess: (_data, { id }) => {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "suggestions"] });
    },
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

  const suggestions = suggestionsQuery.data?.content ?? [];
  const counts = suggestions.reduce<Record<string, number>>((acc, suggestion) => {
    acc[suggestion.status] = (acc[suggestion.status] ?? 0) + 1;
    return acc;
  }, {});
  const filtered = tab === "ALL" ? suggestions : suggestions.filter((suggestion) => suggestion.status === tab);

  return (
    <div className="flex-1 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">건의 관리</h1>
      <p className="mt-1.5 text-sm text-soft">사용자가 남긴 건의를 확인하고 답변합니다.</p>

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
              {item.key === "ALL" ? suggestions.length : (counts[item.key] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      {actionError && <p className="mt-4 text-sm text-coral">{actionError}</p>}

      <div className="mt-5 flex flex-col gap-3">
        {suggestionsQuery.isPending && <p className="text-sm text-soft">불러오는 중…</p>}
        {suggestionsQuery.isError && (
          <p className="text-sm text-coral">목록을 불러오지 못했어요. {getErrorMessage(suggestionsQuery.error)}</p>
        )}
        {suggestionsQuery.isSuccess && filtered.length === 0 && (
          <p className="text-sm text-soft">해당하는 건의가 없어요.</p>
        )}

        {filtered.map((suggestion) => {
          const meta = STATUS_META[suggestion.status];
          return (
            <Card key={suggestion.suggestion_id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b className="font-bold text-ink">{suggestion.title}</b>
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="text-xs text-soft">{suggestion.user_name}</span>
                <span className="ml-auto font-mono text-xs text-soft">
                  {new Date(suggestion.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-sm text-soft">{suggestion.content}</p>

              {suggestion.status === "ANSWERED" ? (
                <div className="mt-1 border-l-2 border-sky bg-wash p-3">
                  <p className="text-xs font-bold text-ink">답변</p>
                  <p className="mt-1 text-sm text-soft">{suggestion.answer_content}</p>
                </div>
              ) : (
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                  <textarea
                    value={drafts[suggestion.suggestion_id] ?? ""}
                    onChange={(event) =>
                      setDrafts((prev) => ({ ...prev, [suggestion.suggestion_id]: event.target.value }))
                    }
                    placeholder="답변을 입력해주세요."
                    rows={2}
                    className="flex-1 resize-none border border-line px-3 py-2 text-sm outline-none focus:border-ink"
                  />
                  <button
                    type="button"
                    disabled={answerMutation.isPending || !(drafts[suggestion.suggestion_id] ?? "").trim()}
                    onClick={() => {
                      setActionError(null);
                      answerMutation.mutate({
                        id: suggestion.suggestion_id,
                        answerContent: drafts[suggestion.suggestion_id] ?? "",
                      });
                    }}
                    className="flex-none self-end bg-sky px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60 sm:self-auto"
                  >
                    답변 등록
                  </button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
