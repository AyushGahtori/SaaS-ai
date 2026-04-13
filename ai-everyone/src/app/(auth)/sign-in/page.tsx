import dynamic from "next/dynamic";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const SignInPageClient = dynamic(() => import("./page.client"), {
  loading: () => (
    <DashboardRouteSkeleton
      title="Loading sign in"
      subtitle="Preparing authentication flow..."
    />
  ),
});

export default function Page() {
  return <SignInPageClient />;
}
