import dynamic from "next/dynamic";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const SettingsPageClient = dynamic(() => import("./page.client"), {
  loading: () => (
    <DashboardRouteSkeleton
      title="Loading settings"
      subtitle="Preparing profile and workspace controls..."
    />
  ),
});

export default function Page() {
  return <SettingsPageClient />;
}
