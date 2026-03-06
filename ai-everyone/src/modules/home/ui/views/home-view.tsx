"use client";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export const HomeView = () => {
  const { data: session } = authClient.useSession();
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.hello.queryOptions({
      text: session?.user?.name || "User",
    })
  );
  if (!session) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex flex-col p-4 gap-y-4">
      <div>
        {data?.greeting}
      </div>
    </div>
  );
};
