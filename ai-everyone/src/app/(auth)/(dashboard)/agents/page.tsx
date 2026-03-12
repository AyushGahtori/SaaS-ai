"use client";
// Agents marketplace page — auth-guarded, renders the AgentsView.
import { AgentsView } from "@/modules/agents/ui/views/agents-view";
import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const Page = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending) return null;
  if (!session) return null;

  return <AgentsView />;
};

export default Page;
