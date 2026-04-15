"use client";

import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/modules/auth/ui/components/protected-route";
import { RouteLoadingState } from "@/modules/dashboard/ui/components/route-loading-state";
import type { Agent } from "@/lib/firestore-agents";

interface AgentsCatalogPayload {
  allAgents: Agent[];
  featuredAgents: Agent[];
  trendingAgents: Agent[];
}

interface AgentsRouteProps {
  initialCatalog: AgentsCatalogPayload;
}

const AgentsView = dynamic(
  () => import("@/modules/agents/ui/views/agents-view").then((mod) => mod.AgentsView),
  {
    ssr: false,
    loading: () => <RouteLoadingState message="Loading agent marketplace..." />,
  }
);

export function AgentsRoute({ initialCatalog }: AgentsRouteProps) {
  return (
    <ProtectedRoute fallback={<RouteLoadingState message="Preparing marketplace..." />}>
      <AgentsView initialCatalog={initialCatalog} />
    </ProtectedRoute>
  );
}
