"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { AgentWorkspaceView } from "@/modules/agents/ui/views/agent-workspace-view";

const Page = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const params = useParams<{ agentId: string }>();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [session, isPending, router]);

  if (isPending || !session) return null;

  return <AgentWorkspaceView agentId={decodeURIComponent(params.agentId)} />;
};

export default Page;
