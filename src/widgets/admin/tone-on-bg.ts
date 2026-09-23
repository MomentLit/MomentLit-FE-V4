import type { SpectrumTone } from "@/shared/ui";

/** Local copy of the same literal `bg-{tone}` map other widgets keep (see search-page/ui/tone-dot.ts) — written out so Tailwind's static scanner generates every class. */
export const TONE_ON_BG: Record<SpectrumTone, string> = {
  sky: "bg-sky text-ink",
  lime: "bg-lime text-ink",
  lemon: "bg-lemon text-ink",
  coral: "bg-coral text-ink",
  rose: "bg-rose text-ink",
  violet: "bg-violet text-ink",
};
