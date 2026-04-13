"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { waitForFirebaseUser } from "@/lib/firebase-client-lazy";

interface AuthenticatedRouteProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  redirectTo?: string;
}

export function AuthenticatedRoute({
  children,
  fallback,
  redirectTo = "/sign-in",
}: AuthenticatedRouteProps) {
  const [status, setStatus] = useState<"pending" | "authed" | "guest">("pending");
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const resolveAuth = async () => {
      try {
        const user = await waitForFirebaseUser();
        if (!isMounted) return;
        setStatus(user ? "authed" : "guest");
      } catch {
        if (!isMounted) return;
        setStatus("guest");
      }
    };

    void resolveAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (status === "guest") {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, status]);

  if (status !== "authed") {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

interface GuestOnlyRouteProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  redirectTo?: string;
}

export function GuestOnlyRoute({
  children,
  fallback,
  redirectTo = "/",
}: GuestOnlyRouteProps) {
  const [status, setStatus] = useState<"pending" | "authed" | "guest">("pending");
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    const resolveAuth = async () => {
      try {
        const user = await waitForFirebaseUser();
        if (!isMounted) return;
        setStatus(user ? "authed" : "guest");
      } catch {
        if (!isMounted) return;
        setStatus("guest");
      }
    };

    void resolveAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (status === "authed") {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, status]);

  if (status !== "guest") {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
