"use client";
// Sign-in page — redirects authenticated users to home, shows sign-in form otherwise.
import { SignInView } from "@/modules/auth/views/sign-in-views";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Page = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // If the user is already authenticated, redirect to home.
  useEffect(() => {
    if (!isPending && session) {
      router.push("/");
    }
  }, [session, isPending, router]);

  // Show nothing while checking auth state.
  if (isPending) return null;

  // If already logged in, don't render the sign-in form (redirect will happen).
  if (session) return null;

  return <SignInView />;
};

export default Page;