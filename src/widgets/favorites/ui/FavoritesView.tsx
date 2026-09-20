"use client";

import { useQuery } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { ResultList } from "@/widgets/search-page";
import { fetchLikedSpaces } from "@/entities/space/api";
import { getErrorMessage } from "@/shared/api/error";

/** 관심 공간 — 내가 좋아요한 공간 목록. `GET /spaces/me/liked`, 검색 결과와 같은 카드(`ResultList`)를 재사용한다. */
export function FavoritesView() {
  const { ready } = useRequireAuth();

  const likedQuery = useQuery({
    queryKey: ["spaces", "liked"],
    queryFn: () => fetchLikedSpaces(),
    enabled: ready,
  });

  if (!ready) {
    return (
      <div className="flex-1 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">관심 공간</h1>
        <p className="mt-3 text-sm text-soft">로그인이 필요한 서비스입니다.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">관심 공간</h1>
      <p className="mt-1.5 text-sm text-soft">좋아요한 공간을 한눈에 모아봐요.</p>

      <ResultList
        items={likedQuery.data?.content ?? []}
        isLoading={likedQuery.isPending}
        isError={likedQuery.isError}
        errorMessage={likedQuery.error ? getErrorMessage(likedQuery.error) : undefined}
        emptyMessage="아직 좋아요한 공간이 없어요."
      />
    </div>
  );
}
