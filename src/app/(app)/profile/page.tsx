import type { Metadata } from "next";
import { ProfileView } from "@/widgets/profile";

export const metadata: Metadata = { title: "마이페이지" };

export default function ProfilePage() {
  return <ProfileView />;
}
