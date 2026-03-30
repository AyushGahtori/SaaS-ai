"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { SettingsView } from "@/modules/settings/ui/views/settings-view";

const Page = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) {
      router.push("/sign-in");
    }
  }, [isPending, router, session]);

  if (isPending) return null;
  if (!session) return null;

  return <SettingsView />;
};

export default Page;
