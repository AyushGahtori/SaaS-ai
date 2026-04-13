"use client";

import dynamic from "next/dynamic";
import { GuestOnlyRoute } from "@/components/auth/authenticated-route";
import { DashboardRouteSkeleton } from "@/components/performance/dashboard-route-skeleton";

const SignInView = dynamic(
  () => import("@/modules/auth/views/sign-in-views").then((module) => module.SignInView),
  { ssr: false }
);

export default function SignInPageClient() {
  const fallback = (
    <DashboardRouteSkeleton
      title="Checking your session"
      subtitle="Redirecting to your workspace if already signed in..."
    />
  );

  return (
    <GuestOnlyRoute fallback={fallback} redirectTo="/">
      <SignInView />
    </GuestOnlyRoute>
  );
}
