"use client";

import dynamic from "next/dynamic";
import { ProtectedRoute } from "@/modules/auth/ui/components/protected-route";
import { RouteLoadingState } from "@/modules/dashboard/ui/components/route-loading-state";
import { FirestoreAbortNoiseGuard } from "@/components/dev/firestore-abort-noise-guard";

const ChatView = dynamic(
  () => import("@/modules/chat/ui/views/chat-view").then((mod) => mod.ChatView),
  {
    ssr: false,
    loading: () => <RouteLoadingState message="Loading chat..." />,
  }
);

export function ChatRoute() {
  return (
    <ProtectedRoute fallback={<RouteLoadingState message="Preparing chat..." />}>
      <FirestoreAbortNoiseGuard />
      <ChatView />
    </ProtectedRoute>
  );
}
