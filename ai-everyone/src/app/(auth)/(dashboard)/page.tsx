import dynamic from "next/dynamic";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const DashboardHomePageClient = dynamic(() => import("./page.client"), {
  loading: () => (
    <DashboardRouteSkeleton
      title="Loading chat workspace"
      subtitle="Starting your personalized assistant..."
    />
  ),
});

export default function Page() {
  return <DashboardHomePageClient />;
}
