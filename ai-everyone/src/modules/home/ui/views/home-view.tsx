"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const HomeView = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const trpc = useTRPC();
  const { data } = useQuery(trpc.hello.queryOptions({ text: "Ayush" }));

  if (!session) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="flex flex-col p-4 gap-y-4">
      <div>
        {data?.greeting}
      </div>

      <div>
        <Button
          onClick={() =>
            authClient.signOut({
              fetchOptions: {
                onSuccess: () => router.push("/sign-in"),
              },
            })
          }
          className="bg-gray-700 hover:bg-gray-600"
        >
          Sign Out
        </Button>
      </div>
    </div>
  );
};
