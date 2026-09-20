import {
  LandingHeader,
  LandingHero,
  OpenPopups,
  CategoryMosaic,
  RegionGrid,
  DuoSection,
  StepsSection,
  ClosingCta,
  LandingFooter,
} from "@/widgets/landing";

/**
 * Landing route group entry point — ports design-reference.html's `#p-lp`
 * frame (see ANALYSIS.md §2.1). Sections that show data (팝업, 검색 등) are
 * wired to the real backend; only static layout config (카테고리 모자이크
 * 순서/칸 크기) stays hardcoded in `mockData.ts`.
 */
export default function LandingPage() {
  return (
    <main className="flex-1">
      <LandingHeader />
      <LandingHero />
      <OpenPopups />
      <CategoryMosaic />
      <RegionGrid />
      <DuoSection />
      <StepsSection />
      <ClosingCta />
      <LandingFooter />
    </main>
  );
}
