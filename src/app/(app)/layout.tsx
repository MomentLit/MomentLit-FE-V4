import { Sidebar } from "@/widgets/app-dashboard";

/** Logged-in app shell — sidebar (home/search/reservations/messages/favorites/suggestions) + content. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <Sidebar />
      {children}
    </div>
  );
}
