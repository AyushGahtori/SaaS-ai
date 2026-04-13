import dynamic from "next/dynamic";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const AgentsPageClient = dynamic(() => import("./page.client"), {
  loading: () => (
    <DashboardRouteSkeleton
      title="Loading agent marketplace"
      subtitle="Fetching bundles, installs, and recommendations..."
    />
  ),
});

export default function Page() {
  return <AgentsPageClient />;
}
