"use client";

import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/modules/auth/ui/components/protected-route";
import { RouteLoadingState } from "@/modules/dashboard/ui/components/route-loading-state";

const BloomAiView = dynamic(
  () => import("@/modules/bloom-ai/ui/views/bloom-ai-view").then((mod) => mod.BloomAiView),
  {
    ssr: false,
    loading: () => <RouteLoadingState message="Loading Bloom AI..." className="flex h-full items-center justify-center" />,
  }
);

export function BloomAiRoute() {
  return (
    <ProtectedRoute fallback={<RouteLoadingState message="Preparing Bloom AI..." className="flex h-full items-center justify-center" />}>
      <BloomAiView />
    </ProtectedRoute>
  );
}
