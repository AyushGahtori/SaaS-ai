"use client";
// Dashboard page — redirects unauthenticated users to sign-in, shows home view otherwise.
import { HomeView } from "@/modules/home/ui/views/home-view";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Page = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // If the user is not authenticated, redirect to sign-in.
  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  // Show nothing while checking auth state.
  if (isPending) return null;

  // If not logged in, don't render the home view (redirect will happen).
  if (!session) return null;

  return <HomeView />;
};

export default Page;