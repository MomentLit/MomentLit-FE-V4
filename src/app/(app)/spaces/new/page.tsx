import type { Metadata } from "next";
import { RegistrationForm } from "@/widgets/registration-form";

export const metadata: Metadata = {
  title: "공간 등록",
};

/**
 * 공간 등록 (4단계 마법사). Widget does all the work — see
 * src/widgets/registration-form. Port of design-reference.html `#p-new`
 * (see ANALYSIS.md §2.6).
 */
export default function NewSpacePage() {
  return (
    <main className="flex-1 bg-wash">
      <div className="mx-auto max-w-[1000px] bg-white shadow-[0_0_0_1px_var(--line)]">
        <RegistrationForm />
      </div>
    </main>
  );
}
