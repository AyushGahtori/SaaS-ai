"use client";

import dynamic from "next/dynamic";
import { AuthenticatedRoute } from "@/components/auth/authenticated-route";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const AgentsView = dynamic(
  () => import("@/modules/agents/ui/views/agents-view").then((module) => module.AgentsView),
  {
    ssr: false,
    loading: () => (
      <DashboardRouteSkeleton
        title="Loading marketplace UI"
        subtitle="Preparing featured and trending sections..."
      />
    ),
  }
);

export default function AgentsPageClient() {
  const fallback = (
    <DashboardRouteSkeleton
      title="Checking your session"
      subtitle="Verifying access to your agent catalog..."
    />
  );

  return (
    <AuthenticatedRoute fallback={fallback}>
      <AgentsView />
    </AuthenticatedRoute>
  );
}
