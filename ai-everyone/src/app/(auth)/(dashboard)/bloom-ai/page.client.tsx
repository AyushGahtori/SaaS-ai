"use client";

import dynamic from "next/dynamic";
import { AuthenticatedRoute } from "@/components/auth/authenticated-route";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const BloomAiView = dynamic(
  () => import("@/modules/bloom-ai").then((module) => module.BloomAiView),
  {
    ssr: false,
    loading: () => (
      <DashboardRouteSkeleton
        title="Initializing Bloom AI"
        subtitle="Loading conversations, notes, and reminders..."
      />
    ),
  }
);

export default function BloomAiPageClient() {
  const fallback = (
    <DashboardRouteSkeleton
      title="Checking your session"
      subtitle="Verifying Bloom AI access..."
    />
  );

  return (
    <AuthenticatedRoute fallback={fallback}>
      <BloomAiView />
    </AuthenticatedRoute>
  );
}
