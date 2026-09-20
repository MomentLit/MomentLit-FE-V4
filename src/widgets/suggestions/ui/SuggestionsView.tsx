"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { createSuggestion, fetchMySuggestions, type SuggestionStatus } from "@/entities/suggestion";
import { Badge, Card } from "@/shared/ui";
import { getErrorMessage } from "@/shared/api/error";

const STATUS_META: Record<SuggestionStatus, { label: string; variant: "pending" | "approved" }> = {
  PENDING: { label: "답변 대기", variant: "pending" },
  ANSWERED: { label: "답변 완료", variant: "approved" },
};

/** 건의함 — 자유롭게 건의사항을 남기고, 관리자 답변을 확인한다. `POST /suggestions` + `GET /suggestions/me`. */
export function SuggestionsView() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mySuggestionsQuery = useQuery({
    queryKey: ["suggestions", "me"],
    queryFn: fetchMySuggestions,
    enabled: ready,
  });

  const createMut = useMutation({
    mutationFn: createSuggestion,
    onSuccess: () => {
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["suggestions", "me"] });
    },
    onError: (submitError) => setError(getErrorMessage(submitError)),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    createMut.mutate({ title, content });
  }

  const suggestions = mySuggestionsQuery.data?.content ?? [];

  if (!ready) {
    return (
      <div className="flex-1 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">건의함</h1>
        <p className="mt-3 text-sm text-soft">로그인이 필요한 페이지예요.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">건의함</h1>
      <p className="mt-1.5 text-sm text-soft">모먼트릿에게 하고 싶은 이야기를 자유롭게 남겨주세요.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 border border-line bg-white p-4 sm:p-5">
        <input
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="제목"
          className="border border-line px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <textarea
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="건의 내용을 입력해주세요."
          rows={4}
          className="resize-none border border-line px-3 py-2 text-sm outline-none focus:border-ink"
        />
        {error && <p className="text-sm text-coral">{error}</p>}
        <button
          type="submit"
          disabled={createMut.isPending}
          className="self-end bg-sky px-4 py-2 text-sm font-bold text-ink transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {createMut.isPending ? "등록 중…" : "건의하기"}
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3">
        {mySuggestionsQuery.isPending && <p className="text-sm text-soft">불러오는 중…</p>}
        {mySuggestionsQuery.isError && (
          <p className="text-sm text-coral">불러오지 못했어요. {getErrorMessage(mySuggestionsQuery.error)}</p>
        )}
        {mySuggestionsQuery.isSuccess && suggestions.length === 0 && (
          <p className="text-sm text-soft">아직 보낸 건의가 없어요.</p>
        )}

        {suggestions.map((suggestion) => {
          const meta = STATUS_META[suggestion.status];
          return (
            <Card key={suggestion.suggestion_id} className="flex flex-col gap-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b className="font-bold text-ink">{suggestion.title}</b>
                <Badge variant={meta.variant}>{meta.label}</Badge>
                <span className="ml-auto font-mono text-xs text-soft">
                  {new Date(suggestion.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-sm text-soft">{suggestion.content}</p>
              {suggestion.status === "ANSWERED" && (
                <div className="mt-1 border-l-2 border-sky bg-wash p-3">
                  <p className="text-xs font-bold text-ink">모먼트릿 답변</p>
                  <p className="mt-1 text-sm text-soft">{suggestion.answer_content}</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
