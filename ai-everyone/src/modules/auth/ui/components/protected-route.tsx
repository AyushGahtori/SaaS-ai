"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { RouteLoadingState } from "@/modules/dashboard/ui/components/route-loading-state";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  fallback,
  redirectTo = "/sign-in",
}: ProtectedRouteProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace(redirectTo);
    }
  }, [isPending, redirectTo, router, session]);

  if (isPending || !session) {
    return <>{fallback ?? <RouteLoadingState message="Checking your session..." />}</>;
  }

  return <>{children}</>;
}
