"use client";

import {
  MultiPhotoUpload,
  countPendingUploads,
  resolvePhotoUrls,
  toPhotoItems,
  useRevokePhotoItemsOnUnmount,
  type PhotoItem,
} from "@/shared/ui/MultiPhotoUpload";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRequireAuth } from "@/widgets/auth";
import { fetchSpace, updateSpace } from "@/entities/space/api";
import {
  MAX_SPACE_PHOTOS,
  SPACE_HERO_ASPECT,
  getSpacePhotoUrls,
  isValidExternalBookingUrl,
  joinSpaceDescription,
  splitSpaceDescription,
  type BookingType,
} from "@/entities/space";
import type { SpaceCategory } from "@/entities/space-category";
import { uploadImage } from "@/shared/api/upload";
import { getErrorMessage } from "@/shared/api/error";
import { FormField, fieldInputClass } from "@/widgets/registration-form/FormField";
import { CategoryPicker } from "@/widgets/registration-form/CategoryPicker";
import { BookingTypeField } from "@/widgets/registration-form/BookingTypeField";
import { PanoramaPhotoField } from "@/widgets/panorama/ui/PanoramaPhotoField";

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
  const [notice, setNotice] = useState("");
  const [area, setArea] = useState("");
  const [capacity, setCapacity] = useState("");
  const [price, setPrice] = useState("");
  const [floor, setFloor] = useState("");
  const [parkingInfo, setParkingInfo] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [photoOverflow, setPhotoOverflow] = useState(false);
  useRevokePhotoItemsOnUnmount(photos);
  // 폼은 처음 불러왔을 때(또는 다른 공간으로 바뀌었을 때) 한 번만 채운다 — 창 복귀 등으로
  // 재조회될 때마다 다시 채우면 저장하지 않은 수정 내용이 서버 값으로 덮어써진다.
  const initializedSpaceIdRef = useRef<number | null>(null);
  const [panoramaUrl, setPanoramaUrl] = useState<string | null>(null);
  const [bookingType, setBookingType] = useState<BookingType>("INTERNAL");
  const [externalBookingUrl, setExternalBookingUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!spaceQuery.data || initializedSpaceIdRef.current === spaceId) return;
    initializedSpaceIdRef.current = spaceId;
    const space = spaceQuery.data;
    queueMicrotask(() => {
      setName(space.name);
      setCategory(space.category);
      const intro = splitSpaceDescription(space.description);
      setDescription(intro.description);
      setNotice(intro.notice);
      setArea(space.area != null ? String(space.area) : "");
      setCapacity(space.capacity != null ? String(space.capacity) : "");
      setPrice(String(space.price_per_hour));
      setFloor(space.floor ?? "");
      setParkingInfo(space.parking_info ?? "");
      setPanoramaUrl(space.panorama_url ?? null);
      setPhotos(toPhotoItems(getSpacePhotoUrls(space)));
      setBookingType(space.booking_type ?? "INTERNAL");
      setExternalBookingUrl(space.external_booking_url ?? "");
    });
  }, [spaceQuery.data, spaceId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim() || !description.trim()) {
      setError("공간 이름과 소개를 입력해 주세요.");
      return;
    }

    // 백엔드는 thumbnail_url이 비어 있으면 "변경 없음"으로 처리해 대표 사진을 지울 수 없다.
    // 전부 지우고 저장하면 성공처럼 보이지만 대표 사진이 그대로 남으므로 막는다.
    if (photos.length === 0 && spaceQuery.data && getSpacePhotoUrls(spaceQuery.data).length > 0) {
      setError("등록된 사진을 모두 지울 수는 없어요. 대표 사진으로 쓸 사진을 한 장 이상 남겨 주세요.");
      return;
    }

    if (bookingType === "EXTERNAL" && !isValidExternalBookingUrl(externalBookingUrl)) {
      setError("예약 페이지 링크를 http:// 또는 https://로 시작하는 주소로 입력해 주세요.");
      return;
    }

    setSubmitting(true);
    try {
      const total = countPendingUploads(photos);
      let uploaded = 0;
      setUploadProgress(total > 0 ? { done: 0, total } : null);
      const imageUrls = await resolvePhotoUrls(photos, (file) => uploadImage(file), {
        onUploaded: () => setUploadProgress({ done: ++uploaded, total }),
      });
      setUploadProgress(null);

      // 바뀌지 않았으면 보내지 않고(undefined), 삭제했으면 빈 문자열을 보낸다 — 백엔드 `Space.updatePanoramaUrl` 규칙.
      const originalPanoramaUrl = spaceQuery.data?.panorama_url ?? null;
      const panoramaUrlChange = panoramaUrl === originalPanoramaUrl ? undefined : (panoramaUrl ?? "");

      await updateSpace(spaceId, {
        name: name.trim(),
        description: joinSpaceDescription(description, notice),
        category,
        area: area.trim() ? Number(area) : undefined,
        capacity: capacity.trim() ? Number(capacity) : undefined,
        price_per_hour: price.trim() ? Number(price) : undefined,
        floor: floor.trim() || undefined,
        parking_info: parkingInfo.trim() || undefined,
        // 백엔드는 image_urls가 오면 기존 사진 목록을 통째로 교체한다.
        thumbnail_url: imageUrls[0],
        image_urls: imageUrls,
        panorama_url: panoramaUrlChange,
        booking_type: bookingType,
        external_booking_url: bookingType === "EXTERNAL" ? externalBookingUrl.trim() : undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ["space", spaceId] });
      await queryClient.invalidateQueries({ queryKey: ["spaces", "me"] });
      router.push(`/spaces/${spaceId}`);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setUploadProgress(null);
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
    <div className="page-shell flex flex-col gap-7">
      <div>
        <h1 className="page-title text-ink">공간 정보 수정</h1>
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

        <BookingTypeField
          bookingType={bookingType}
          externalBookingUrl={externalBookingUrl}
          onBookingTypeChange={setBookingType}
          onExternalBookingUrlChange={setExternalBookingUrl}
        />

        <FormField label="공간 소개" full>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${fieldInputClass} resize-y leading-[1.7]`}
          />
        </FormField>

        <FormField
          label="기타사항 (선택)"
          full
          hint="이용 수칙, 주의사항, 추가 비용(청소비·보증금 등)처럼 예약 전에 꼭 알아야 할 내용을 적어 주세요."
        >
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={4}
            aria-label="기타사항"
            className={`${fieldInputClass} resize-y leading-[1.7]`}
          />
        </FormField>

        <FormField
          label="공간 사진"
          full
          hint={photoOverflow ? `사진은 최대 ${MAX_SPACE_PHOTOS}장까지 올릴 수 있어요. 넘친 사진은 빠졌어요.` : undefined}
        >
          <MultiPhotoUpload
            items={photos}
            max={MAX_SPACE_PHOTOS}
            cropAspect={SPACE_HERO_ASPECT}
            disabled={submitting}
            onChange={(next) => {
              setPhotoOverflow(false);
              setPhotos(next);
            }}
            onOverflow={() => setPhotoOverflow(true)}
          />
        </FormField>

        <PanoramaPhotoField
          value={panoramaUrl}
          onChange={setPanoramaUrl}
          title={name.trim() || "공간"}
          disabled={submitting}
          saveHint
        />

        {error && (
          <p className="shadow-[inset_3px_0_0_var(--coral)] bg-wash px-4.5 py-3 text-[0.88rem] text-coral sm:col-span-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="button button--primary self-start sm:col-span-2"
        >
          {submitting
            ? uploadProgress
              ? `사진 올리는 중 ${uploadProgress.done}/${uploadProgress.total}`
              : "저장 중…"
            : "저장하기"}
        </button>
      </form>

    </div>
  );
}
