import { IconStar, IconStarFilled } from "@tabler/icons-react";

export interface StarRatingProps {
  /** 1–5. Values outside that range just clamp visually (no stars / all stars). */
  rating: number;
  size?: number;
  className?: string;
}

/** 5칸 별점 표시 — 리뷰 카드에서 공통으로 쓴다. */
export function StarRating({ rating, size = 14, className }: StarRatingProps) {
  return (
    <span aria-label={`별점 ${rating}점`} className={`inline-flex items-center gap-0.5 text-yellow-600 ${className ?? ""}`}>
      {Array.from({ length: 5 }, (_, i) =>
        i < rating ? (
          <IconStarFilled key={i} size={size} aria-hidden />
        ) : (
          <IconStar key={i} size={size} stroke={1.75} aria-hidden />
        ),
      )}
    </span>
  );
}
