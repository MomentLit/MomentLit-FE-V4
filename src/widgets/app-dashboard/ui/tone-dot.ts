import type { SpectrumTone } from "@/shared/ui";

/**
 * Literal `bg-{tone}` class map for small color indicators (pill dots, region
 * swatches) — kept local to this widget rather than added to shared/ui.
 * Written out literally (not built with a template string) so Tailwind's
 * static scanner can see and generate every class — see the same note on
 * `TONE_CLASSES` in shared/ui/Card.tsx.
 */
export const TONE_DOT_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky",
  lime: "bg-lime",
  lemon: "bg-lemon",
  coral: "bg-coral",
  rose: "bg-rose",
  violet: "bg-violet",
};

export const TONE_ON_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky text-ink",
  lime: "bg-lime text-ink",
  lemon: "bg-lemon text-ink",
  coral: "bg-coral text-ink",
  rose: "bg-rose text-ink",
  violet: "bg-violet text-ink",
};
