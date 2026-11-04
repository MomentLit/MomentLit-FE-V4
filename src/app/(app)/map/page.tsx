import { Suspense } from "react";
import { MapPageContent } from "@/widgets/map/MapPageContent";

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex-1 p-10 text-sm text-soft">불러오는 중…</div>}>
      <MapPageContent />
    </Suspense>
  );
}
