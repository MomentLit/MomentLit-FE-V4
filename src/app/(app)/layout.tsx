import { Sidebar } from "@/widgets/app-dashboard";
import { ChatbotDrawer } from "@/widgets/chatbot";

/** Logged-in app shell — sidebar (home/search/reservations/messages/favorites/suggestions) + content. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-white md:flex-row">
      <Sidebar />
      {children}
      <ChatbotDrawer />
    </div>
  );
}
