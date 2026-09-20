import { Card } from "@/shared/ui";
import { cn } from "@/shared/lib";
import { SPACE_CATEGORY_COLORS, SPACE_CATEGORY_LABELS } from "@/entities/space-category";
import { REGION_LABELS } from "@/entities/region";
import type { SpaceDetail } from "@/entities/space";

/**
 * Hero band — host가 올린 대표 사진이 있으면 그 사진을, 없으면 카테고리 색상 필드를 보여준다.
 * Ported from design-reference `.dt-hero`.
 */
export function DetailHero({ space }: { space: SpaceDetail }) {
  const tone = SPACE_CATEGORY_COLORS[space.category];
  const { address } = space;
  const shortLocation = address.region ? REGION_LABELS[address.region] : address.sido;
  const fullLocation = `${address.sido} ${address.sigungu} ${address.eup_myeon_dong}`;
  const hasPhoto = Boolean(space.thumbnail_url);

  return (
    <Card
      tone={hasPhoto ? undefined : tone}
      className="relative flex aspect-[21/9] flex-col justify-between gap-8 overflow-hidden rounded-3xl rounded-b-none p-6 sm:aspect-[21/7] sm:p-10"
    >
      {hasPhoto && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- 외부 S3 URL */}
          <img src={space.thumbnail_url!} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/40" />
        </>
      )}
      <span
        className={cn(
          "relative font-mono text-[0.66rem] font-medium uppercase tracking-[0.14em]",
          hasPhoto && "text-white",
        )}
      >
        {SPACE_CATEGORY_LABELS[space.category]} · {shortLocation}
      </span>
      <div className="relative">
        <h1 className={cn("text-3xl font-semibold tracking-tight sm:text-5xl", hasPhoto && "text-white")}>
          {space.name}
        </h1>
        <p className={cn("mt-2 text-sm opacity-90 sm:text-base", hasPhoto && "text-white")}>{fullLocation}</p>
      </div>
    </Card>
  );
}
