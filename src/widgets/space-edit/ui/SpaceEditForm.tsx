"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { fetchSpace, updateSpace } from "@/entities/space/api";
import type { SpaceCategory } from "@/entities/space-category";
import { uploadImage } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import { FormField, fieldInputClass } from "@/widgets/registration-form/FormField";
import { CategoryPicker } from "@/widgets/registration-form/CategoryPicker";

/**
 * 공간 정보 수정 — 등록 마법사와 달리 한 페이지짜리 단순 폼이다. 주소/주간 일정은 여기서 안 건드린다
 * (주소는 지역 재계산이 얽혀있고, 일정은 기존 슬롯을 한 덩어리 [시작,종료,단위]로 되돌릴 수 없어서
 * 별도 화면이 더 적합하다 — 지금은 새로 등록할 때와 같은 방식으로 다시 설정해야 한다).
 */
export function SpaceEditForm({ spaceId }: { spaceId: number }) {
  const { ready } = useRequireAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const spaceQuery = useQuery({ queryKey: ["space", spaceId], queryFn: () => fetchSpace(spaceId), enabled: ready });

  const [name, setName] = useState("");
  const [category, setCategory] = useState<SpaceCategory>("POPUP_STORE");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [floor, setFloor] = useState("");
  const [parkingInfo, setParkingInfo] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceQuery.data) return;
    const space = spaceQuery.data;
    queueMicrotask(() => {
      setName(space.name);
      setCategory(space.category);
      setDescription(space.description);
      setArea(space.area != null ? String(space.area) : "");
      setCapacity(space.capacity != null ? String(space.capacity) : "");
      setPrice(String(space.price_per_hour));
      setFloor(space.floor ?? "");
      setParkingInfo(space.parking_info ?? "");
    });
  }, [spaceQuery.data]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !description.trim()) {
      setError("공간 이름과 소개를 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      let thumbnailUrl: string | undefined;
      if (thumbnailFile) {
        thumbnailUrl = await uploadImage(thumbnailFile);
      }

      await updateSpace(spaceId, {
        name: name.trim(),
        description: description.trim(),
        category,
        area: area.trim() ? Number(area) : undefined,
        capacity: capacity.trim() ? Number(capacity) : undefined,
        price_per_hour: price.trim() ? Number(price) : undefined,
        floor: floor.trim() || undefined,
        parking_info: parkingInfo.trim() || undefined,
        thumbnail_url: thumbnailUrl,
      });

      await queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
      await queryClient.invalidateQueries({ queryKey: ["spaces", "me"] });
      router.push(`/spaces/${spaceId}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setSubmitting(false);
    }
  }

  if (!ready) {
    return <div className="flex-1 p-10 text-sm text-soft">로그인이 필요한 서비스입니다.</div>;
  }

  if (spaceQuery.isPending) {
    return <div className="flex-1 p-10 text-sm text-soft">불러오는 중…</div>;
  }

  if (spaceQuery.isError) {
    return (
      <div className="flex-1 p-10 text-center">
        <p className="text-sm text-coral">공간 정보를 불러오지 못했어요. {getErrorMessage(spaceQuery.error)}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7 p-[clamp(22px,3vw,40px)]">
      <div>
        <h1 className="text-[clamp(1.5rem,3vw,2.2rem)] font-semibold tracking-tight text-ink">공간 정보 수정</h1>
        <p className="mt-2 text-[0.92rem] text-soft">
          주소와 예약 일정은 여기서 바꿀 수 없어요. 일정을 다시 열려면 공간 상세 페이지에서 별도로 설정해 주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid max-w-[720px] grid-cols-1 gap-4.5 sm:grid-cols-2">
        <FormField label="공간 이름" full>
          <input value={name} onChange={(e) => setName(e.target.value)} className={fieldInputClass} />
        </FormField>

        <FormField label="카테고리" full>
          <CategoryPicker value={category} onChange={setCategory} />
        </FormField>

        <FormField label="면적 (㎡)">
          <input type="number" min={0} value={area} onChange={(e) => setArea(e.target.value)} className={fieldInputClass} />
        </FormField>

        <FormField label="최대 수용 인원">
          <input
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className={fieldInputClass}
          />
        </FormField>

        <FormField label="시간당 요금 (원)">
          <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={fieldInputClass} />
        </FormField>

        <FormField label="층수">
          <input value={floor} onChange={(e) => setFloor(e.target.value)} className={fieldInputClass} />
        </FormField>

        <FormField label="주차 정보" full>
          <input value={parkingInfo} onChange={(e) => setParkingInfo(e.target.value)} className={fieldInputClass} />
        </FormField>

        <FormField label="공간 소개" full>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${fieldInputClass} resize-y leading-[1.7]`}
          />
        </FormField>

        <FormField label="대표 사진 (선택 — 새로 올리면 기존 사진을 대체해요)" full>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] ?? null)}
            className={`${fieldInputClass} py-2.5`}
          />
        </FormField>

        {error && (
          <p className="shadow-[inset_3px_0_0_var(--coral)] bg-wash px-4.5 py-3 text-[0.88rem] text-coral sm:col-span-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="self-start bg-sky px-6 py-3 text-sm font-bold text-ink transition-colors hover:bg-main-d hover:text-white disabled:opacity-60 sm:col-span-2"
        >
          {submitting ? "저장 중…" : "저장하기"}
        </button>
      </form>
    </div>
  );
}
