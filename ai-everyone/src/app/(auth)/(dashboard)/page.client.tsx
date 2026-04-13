"use client";

import dynamic from "next/dynamic";
import { AuthenticatedRoute } from "@/components/auth/authenticated-route";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const ChatView = dynamic(
  () => import("@/modules/chat/ui/views/chat-view-emoji").then((module) => module.ChatViewEmoji),
  {
    ssr: false,
    loading: () => (
      <DashboardRouteSkeleton
        title="Preparing chat"
        subtitle="Loading your recent conversations and tools..."
      />
    ),
  }
);

export default function DashboardHomePageClient() {
  const fallback = (
    <DashboardRouteSkeleton
      title="Checking your session"
      subtitle="Signing you in and loading your workspace..."
    />
  );

  return (
    <AuthenticatedRoute fallback={fallback}>
      <ChatView />
    </AuthenticatedRoute>
  );
}
