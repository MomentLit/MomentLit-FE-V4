"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowRight } from "@tabler/icons-react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { fetchMyMatchings } from "@/entities/matching";
import { fetchSpace } from "@/entities/space/api";
import { createPopup } from "@/entities/popup";
import { uploadImage } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";

const fieldInputClass =
  "w-full border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-soft focus:border-sky";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * 팝업 등록 — 승인된 매칭(임대가 확정된 예약) 하나를 골라 그 위에 공개용 팝업 리스팅을 만든다.
 * 운영 기간은 매칭의 대여 기간 그대로 사용한다(팝업이 매칭 기간을 벗어나면 백엔드가 거부하므로,
 * 아예 별도 날짜 입력을 두지 않는 편이 실패할 여지가 없다). Port 없음 — 디자인 레퍼런스에 팝업
 * 등록 화면이 없어 공간 등록 폼의 톤만 가져와 최소 구성으로 새로 짰다.
 */
export function PopupRegistrationForm() {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMatchingId = searchParams.get("matchingId");

  const matchingsQuery = useQuery({ queryKey: ["matchings", "me"], queryFn: fetchMyMatchings, enabled: ready });
  const approvedMatchings = useMemo(
    () => (matchingsQuery.data ?? []).filter((matching) => matching.status === "APPROVED"),
    [matchingsQuery.data],
  );

  const spaceQueries = useQueries({
    queries: approvedMatchings.map((matching) => ({
      queryKey: ["spaces", "detail", matching.space_id],
      queryFn: () => fetchSpace(matching.space_id),
      staleTime: 60_000,
    })),
  });
  const spaceNameById = new Map<number, string>();
  approvedMatchings.forEach((matching, i) => {
    const space = spaceQueries[i]?.data;
    if (space) spaceNameById.set(matching.space_id, space.name);
  });

  const [matchingId, setMatchingId] = useState(preselectedMatchingId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMatching = approvedMatchings.find((matching) => String(matching.matching_id) === matchingId);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!selectedMatching) {
      setError("팝업을 등록할 예약을 선택해주세요.");
      return;
    }
    if (!title.trim() || !description.trim()) {
      setError("제목과 소개를 입력해주세요.");
      return;
    }
    if (!thumbnailFile) {
      setError("대표 사진은 필수예요.");
      return;
    }

    setSubmitting(true);
    try {
      const thumbnailUrl = await uploadImage(thumbnailFile);

      const { popup_id } = await createPopup({
        matching_id: selectedMatching.matching_id,
        title,
        description,
        thumbnail_url: thumbnailUrl,
        start_time: selectedMatching.start_time,
        end_time: selectedMatching.end_time,
      });

      router.push(`/popups/${popup_id}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="flex-1 p-10 text-sm text-soft">로그인이 필요한 서비스입니다.</div>;
  }

  return (
    <div className="flex flex-col gap-7 p-[clamp(22px,3vw,40px)]">
      <div>
        <h1 className="text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-tight text-ink">팝업 등록</h1>
        <p className="mt-2 text-[0.92rem] text-soft">
          승인된 예약 건에 대해 공개용 팝업 페이지를 만들어요. 운영 기간은 예약 기간과 동일하게 설정됩니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-[640px] flex-col gap-4.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink">대상 예약</span>
          {matchingsQuery.isPending ? (
            <p className="text-sm text-soft">불러오는 중…</p>
          ) : approvedMatchings.length === 0 ? (
            <p className="border border-dashed border-line p-3.5 text-sm text-soft">
              승인된 예약이 없어요. 공간을 먼저 예약하고 호스트의 승인을 받아야 팝업을 등록할 수 있어요.
            </p>
          ) : (
            <select
              required
              value={matchingId}
              onChange={(event) => setMatchingId(event.target.value)}
              className={fieldInputClass}
            >
              <option value="" disabled>
                예약을 선택하세요
              </option>
              {approvedMatchings.map((matching) => (
                <option key={matching.matching_id} value={matching.matching_id}>
                  {spaceNameById.get(matching.space_id) ?? `공간 #${matching.space_id}`} ·{" "}
                  {formatDate(matching.start_time)} — {formatDate(matching.end_time)}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink">팝업 이름</span>
          <input
            type="text"
            required
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="예: 주말의 작은 향수 가게"
            className={fieldInputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink">팝업 소개</span>
          <textarea
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            placeholder="어떤 팝업인지 소개해주세요."
            className={`${fieldInputClass} resize-y leading-[1.7]`}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-ink">대표 사진</span>
          <input
            required
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setThumbnailFile(event.target.files?.[0] ?? null)}
            className={`${fieldInputClass} py-2.5`}
          />
          {thumbnailFile && <span className="text-[0.79rem] text-soft">선택됨: {thumbnailFile.name}</span>}
        </label>

        {error && (
          <p className="shadow-[inset_3px_0_0_var(--coral)] bg-wash px-4.5 py-3 text-[0.88rem] text-coral">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || approvedMatchings.length === 0}
          className="inline-flex items-center gap-1.5 self-start bg-sky px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white disabled:opacity-60"
        >
          {submitting ? "등록 중…" : "팝업 등록하기"} <IconArrowRight size={16} stroke={2} aria-hidden />
        </button>
      </form>
    </div>
  );
}
