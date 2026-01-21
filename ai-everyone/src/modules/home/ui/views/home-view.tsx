"use client";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { router } from "better-auth/api";
import { useRouter } from "next/navigation";

export const HomeView = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  if (!session) {
    return (
      <div className="max-w-md mx-auto mt-10">
        Loading...
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-10">
        <h2 className="text-2xl font-bold mb-4">Welcome, {session.user?.name || session.user?.email}!</h2>
        <p>You are logged in.</p>
        <Button onClick={() => authClient.signOut({fetchOptions: { onSuccess: () => router.push("/sign-in")}})}>Sign Out</Button>
      </div>
   );
}
