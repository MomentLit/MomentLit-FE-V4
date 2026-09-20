import type { SpectrumTone } from "@/shared/ui";

/**
 * Literal `bg-{tone}` class map for small color indicators (category dots,
 * result card color fields) — kept local to this widget rather than added
 * to shared/ui. Written out literally so Tailwind's static scanner can see
 * and generate every class — see the same note on `TONE_CLASSES` in
 * shared/ui/Card.tsx.
 */
export const TONE_DOT_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky",
  mint: "bg-mint",
  lime: "bg-lime",
  lemon: "bg-lemon",
  apricot: "bg-apricot",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

export const TONE_ON_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky text-ink",
  mint: "bg-mint text-ink",
  lime: "bg-lime text-ink",
  lemon: "bg-lemon text-ink",
  apricot: "bg-apricot text-ink",
  coral: "bg-coral text-ink",
  rose: "bg-rose text-ink",
  violet: "bg-violet text-ink",
};
