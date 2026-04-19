import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "@/modules/dashboard/ui/components/dashboard-navbar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { ChatProvider } from "@/modules/chat/context/chat-context";
import { OnboardingGuard } from "@/modules/onboarding/ui/onboarding-guard";

interface Props {
  children: React.ReactNode;
}

const Layout = ({ children }: Props) => {
  return (
    <SidebarProvider>
      <ChatProvider>
        <OnboardingGuard>
          <div className="flex h-screen w-full overflow-hidden">
            <DashboardSidebar />

            <main className="flex-1 overflow-hidden bg-black text-foreground">
              <DashboardNavbar />
              {children}
            </main>
          </div>
        </OnboardingGuard>
      </ChatProvider>
    </SidebarProvider>
  );
};

export default Layout;

