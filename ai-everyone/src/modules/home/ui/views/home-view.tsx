"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export const HomeView = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  if (!session) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="h-full w-full bg-black flex flex-col items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Welcome, {session.user?.name || session.user?.email}!
        </h2>

        <p className="mb-6 text-gray-400">
          You are logged in.
        </p>

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
