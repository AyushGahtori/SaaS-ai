"use client";
// Dashboard page — redirects unauthenticated users to sign-in, shows chat view otherwise.
import { ChatView } from "@/modules/chat/ui/views/chat-view";
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

  // If not logged in, don't render the chat view (redirect will happen).
  if (!session) return null;

  return <ChatView />;
};

export default Page;
