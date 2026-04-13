"use client";

import dynamic from "next/dynamic";
import { AuthenticatedRoute } from "@/components/auth/authenticated-route";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const SettingsView = dynamic(
  () => import("@/modules/settings/ui/views/settings-view").then((module) => module.SettingsView),
  {
    ssr: false,
    loading: () => (
      <DashboardRouteSkeleton
        title="Loading settings UI"
        subtitle="Preparing profile, memory, and reminder controls..."
      />
    ),
  }
);

export default function SettingsPageClient() {
  const fallback = (
    <DashboardRouteSkeleton
      title="Checking your session"
      subtitle="Verifying settings access..."
    />
  );

  return (
    <AuthenticatedRoute fallback={fallback}>
      <SettingsView />
    </AuthenticatedRoute>
  );
}
