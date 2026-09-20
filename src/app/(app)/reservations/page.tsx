import type { Metadata } from "next";
import { ReservationsView } from "@/widgets/reservations";

export const metadata: Metadata = { title: "예약" };

export default function ReservationsPage() {
  return <ReservationsView />;
}
