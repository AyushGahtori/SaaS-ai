"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { DashboardNavbar } from "./dashboard-navbar";
import { OnboardingGuard } from "@/modules/onboarding/ui/onboarding-guard";

interface DashboardLayoutShellProps {
  children: React.ReactNode;
}

const ChatProvider = dynamic(
  () => import("@/modules/chat/context/chat-context").then((mod) => mod.ChatProvider)
);

const DashboardSidebar = dynamic(
  () => import("./dashboard-sidebar").then((mod) => mod.DashboardSidebar)
);

function shouldEnableChatRuntime(pathname: string): boolean {
  return !(pathname.startsWith("/bloom") || pathname.startsWith("/bloom-ai"));
}

export function DashboardLayoutShell({ children }: DashboardLayoutShellProps) {
  const pathname = usePathname() || "/";
  const isBloomRoute = pathname.startsWith("/bloom") || pathname.startsWith("/bloom-ai");
  const chatRuntimeEnabled = shouldEnableChatRuntime(pathname);

  const sidebar = isBloomRoute ? null : <DashboardSidebar />;

  const content = (
    <div className="flex h-screen w-full overflow-hidden">
      {sidebar}

      <main className="flex-1 overflow-hidden bg-[var(--surface-0)] text-foreground">
        <DashboardNavbar enableChatRuntime={chatRuntimeEnabled} />
        {children}
      </main>
    </div>
  );

  return (
    <SidebarProvider>
      <OnboardingGuard>{chatRuntimeEnabled ? <ChatProvider>{content}</ChatProvider> : content}</OnboardingGuard>
    </SidebarProvider>
  );
}
