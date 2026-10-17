import { cn, cropHasGap, cropImageStyle, type PhotoCrop } from "@/shared/lib";

/**
 * 맞춘 영역(`crop`)만 틀에 차게 그린다 — 틀은 부모가 `relative overflow-hidden` + 같은 비율로
 * 잡아준다. 사진을 틀보다 작게 줄였으면 남는 틈을 같은 사진을 흐리게 깔아 채운다.
 */
export function CroppedPhoto({ src, crop, alt = "", className }: { src: string; crop: PhotoCrop; alt?: string; className?: string }) {
  return (
    <>
      {cropHasGap(crop) && (
        // eslint-disable-next-line @next/next/no-img-element -- blob 미리보기/외부 S3 URL, 틈 채우기용
        <img src={src} alt="" draggable={false} className={cn("absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl", className)} />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element -- blob 미리보기/외부 S3 URL */}
      <img src={src} alt={alt} draggable={false} className={className} style={cropImageStyle(crop)} />
    </>
  );
}
