import dynamic from "next/dynamic";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const BloomAiPageClient = dynamic(() => import("./page.client"), {
  loading: () => (
    <DashboardRouteSkeleton
      title="Loading Bloom AI"
      subtitle="Preparing your planner workspace..."
    />
  ),
});

export default function Page() {
  return <BloomAiPageClient />;
}
