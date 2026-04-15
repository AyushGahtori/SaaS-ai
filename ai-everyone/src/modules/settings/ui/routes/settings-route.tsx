"use client";

import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/modules/auth/ui/components/protected-route";
import { RouteLoadingState } from "@/modules/dashboard/ui/components/route-loading-state";

const SettingsView = dynamic(
  () => import("@/modules/settings/ui/views/settings-view").then((mod) => mod.SettingsView),
  {
    ssr: false,
    loading: () => <RouteLoadingState message="Loading settings..." />,
  }
);

export function SettingsRoute() {
  return (
    <ProtectedRoute fallback={<RouteLoadingState message="Preparing settings..." />}>
      <SettingsView />
    </ProtectedRoute>
  );
}
