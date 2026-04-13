"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "@/modules/dashboard/ui/components/dashboard-navbar";
import { DashboardSidebar } from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { OnboardingGuard } from "@/modules/onboarding/ui/onboarding-guard";

interface DashboardShellClientProps {
  children: React.ReactNode;
}

const ChatProvider = dynamic(
  () => import("@/modules/chat/context/chat-context").then((module) => module.ChatProvider),
  { ssr: false }
);

export function DashboardShellClient({ children }: DashboardShellClientProps) {
  const pathname = usePathname();
  const isChatRoute = pathname === "/";

  const shell = (
    <SidebarProvider>
      <OnboardingGuard>
        <div className="flex h-screen w-full overflow-hidden">
          <DashboardSidebar />

          <main className="flex-1 overflow-hidden bg-black text-foreground">
            <DashboardNavbar />
            {children}
          </main>
        </div>
      </OnboardingGuard>
    </SidebarProvider>
  );

  if (!isChatRoute) {
    return shell;
  }

  return <ChatProvider>{shell}</ChatProvider>;
}
