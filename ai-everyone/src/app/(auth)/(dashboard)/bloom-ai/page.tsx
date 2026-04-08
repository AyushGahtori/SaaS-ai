"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { BloomAiView } from "@/modules/bloom-ai";

const Page = () => {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !session) router.push("/sign-in");
  }, [isPending, router, session]);

  if (isPending || !session) return null;
  return <BloomAiView />;
};

export default Page;
