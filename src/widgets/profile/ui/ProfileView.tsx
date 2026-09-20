"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { useAuthStore, fetchMe, updateMe } from "@/entities/auth";
import { fetchMySpaces } from "@/entities/space/api";
import { fetchMyPopups } from "@/entities/popup";
import { uploadImage } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import { Badge, type BadgeProps } from "@/shared/ui";
import type { SpaceAdminStatus } from "@/entities/space";

const fieldInputClass =
  "w-full border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-soft focus:border-sky";

const SPACE_STATUS_META: Record<SpaceAdminStatus, { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  DRAFT: { label: "임시저장", variant: "neutral" },
  PENDING: { label: "승인 대기", variant: "pending" },
  APPROVED: { label: "승인됨", variant: "approved" },
  REJECTED: { label: "거절됨", variant: "rejected" },
};

/** 마이페이지 — 프로필 수정(이름/전화번호/상태메시지/사진) + 내 공간·팝업 목록. */
export function ProfileView() {
  const { ready } = useRequireAuth();
  const queryClient = useQueryClient();
  const hydrate = useAuthStore((state) => state.hydrate);

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe, enabled: ready });
  const mySpacesQuery = useQuery({ queryKey: ["spaces", "me"], queryFn: () => fetchMySpaces(), enabled: ready });
  const myPopupsQuery = useQuery({ queryKey: ["popups", "me"], queryFn: fetchMyPopups, enabled: ready });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [intro, setIntro] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!meQuery.data) return;
    const me = meQuery.data;
    queueMicrotask(() => {
      setName(me.name);
      setPhone(me.phone ?? "");
      setIntro(me.intro ?? "");
    });
  }, [meQuery.data]);

  const updateMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: async () => {
      setSaved(true);
      setImageFile(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["me"] }), hydrate()]);
    },
    onError: (submitError) => setError(getErrorMessage(submitError)),
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }
      updateMutation.mutate({
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        intro: intro.trim() || undefined,
        image_url: imageUrl,
      });
    } catch (uploadError) {
      setError(getErrorMessage(uploadError));
    }
  }

  const mySpaces = mySpacesQuery.data?.content ?? [];
  const myPopups = myPopupsQuery.data ?? [];
  const currentImageUrl = meQuery.data?.image_url ?? null;

  if (!ready) {
    return (
      <div className="flex flex-col gap-9 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">마이페이지</h1>
        <p className="text-sm text-soft">로그인이 필요한 서비스입니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-9 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">마이페이지</h1>
        <p className="mt-1.5 text-sm text-soft">프로필 정보를 관리하고, 내가 등록한 공간·팝업을 확인해요.</p>
      </div>

      <section className="max-w-[520px]">
        <h2 className="mb-3 text-lg font-bold text-ink">프로필</h2>
        {meQuery.isPending ? (
          <p className="text-sm text-soft">불러오는 중…</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              {imageFile ? (
                // eslint-disable-next-line @next/next/no-img-element -- 로컬 선택 파일 미리보기
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="선택한 프로필 사진"
                  className="h-14 w-14 flex-none object-cover"
                />
              ) : currentImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL
                <img src={currentImageUrl} alt={name} className="h-14 w-14 flex-none object-cover" />
              ) : (
                <div className="grid h-14 w-14 flex-none place-items-center bg-violet text-lg font-bold text-ink">
                  {name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-ink">프로필 사진</span>
                <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 border border-line bg-white px-3.5 py-2 text-xs font-bold text-ink transition-colors hover:bg-wash">
                  {imageFile ? "사진 변경" : "사진 선택"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                    className="sr-only"
                  />
                </label>
                {imageFile && <span className="text-[0.7rem] text-soft">{imageFile.name}</span>}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink">이메일</span>
              <input value={meQuery.data?.email ?? ""} disabled className={`${fieldInputClass} bg-wash text-soft`} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink">이름</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink">전화번호</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={fieldInputClass} />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ink">상태 메시지</span>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={2}
                placeholder="자기소개를 남겨보세요."
                className={`${fieldInputClass} resize-y`}
              />
            </label>

            {error && <p className="text-sm text-coral">{error}</p>}
            {saved && !error && <p className="text-sm text-ink">저장했어요.</p>}

            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="self-start bg-sky px-6 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white disabled:opacity-60"
            >
              {updateMutation.isPending ? "저장 중…" : "저장하기"}
            </button>
          </form>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">내 공간</h2>
          <Link href="/spaces/new" className="text-xs font-bold text-ink underline">
            새 공간 등록
          </Link>
        </div>
        <div className="flex flex-col gap-2.5">
          {mySpacesQuery.isPending && <p className="text-sm text-soft">불러오는 중…</p>}
          {mySpacesQuery.isSuccess && mySpaces.length === 0 && (
            <p className="text-sm text-soft">아직 등록한 공간이 없어요.</p>
          )}
          {mySpaces.map((space) => {
            const meta = SPACE_STATUS_META[space.admin_status];
            return (
              <div
                key={space.space_id}
                className="flex flex-wrap items-center gap-3 border border-line bg-white p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <b className="font-bold text-ink">{space.name}</b>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {!space.is_active && <Badge variant="neutral">비활성</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm text-soft">{space.price_per_hour.toLocaleString()}원</p>
                </div>
                <div className="flex flex-none gap-2">
                  <Link
                    href={`/spaces/${space.space_id}`}
                    className="border border-line px-3.5 py-2 text-xs font-bold text-ink hover:bg-wash"
                  >
                    보기
                  </Link>
                  <Link
                    href={`/spaces/${space.space_id}/edit`}
                    className="bg-sky px-3.5 py-2 text-xs font-bold text-ink hover:opacity-90"
                  >
                    수정
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold text-ink">내 팝업</h2>
        <div className="flex flex-col gap-2.5">
          {myPopupsQuery.isPending && <p className="text-sm text-soft">불러오는 중…</p>}
          {myPopupsQuery.isSuccess && myPopups.length === 0 && (
            <p className="text-sm text-soft">아직 등록한 팝업이 없어요.</p>
          )}
          {myPopups.map((popup) => (
            <div key={popup.popup_id} className="flex flex-wrap items-center gap-3 border border-line bg-white p-3.5">
              <div className="min-w-0 flex-1">
                <b className="font-bold text-ink">{popup.title}</b>
                <p className="mt-0.5 text-sm text-soft">
                  {popup.start_time.slice(0, 10)} — {popup.end_time.slice(0, 10)}
                </p>
              </div>
              <Link
                href={`/popups/${popup.popup_id}`}
                className="flex-none border border-line px-3.5 py-2 text-xs font-bold text-ink hover:bg-wash"
              >
                보기
              </Link>
            </div>
          ))}
          {myPopups.length > 0 && (
            <p className="text-[0.79rem] text-soft">팝업 수정 기능은 아직 준비 중이에요.</p>
          )}
        </div>
      </section>
    </div>
  );
}
