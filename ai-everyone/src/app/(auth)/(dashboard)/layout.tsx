import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "@/modules/dashboard/ui/components/dashboard-navbar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { ChatProvider } from "@/modules/chat/context/chat-context";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <SidebarProvider>
      <ChatProvider>
        <div className="flex h-screen w-full">
          <DashboardSidebar />

          <main className="flex-1 bg-black text-foreground">
            <DashboardNavbar />
            {children}
          </main>
        </div>
      </ChatProvider>
    </SidebarProvider>
  );
};

export default Layout;

