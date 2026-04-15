"use client";

import { Loader2 } from "lucide-react";

interface RouteLoadingStateProps {
  message?: string;
  className?: string;
}

export function RouteLoadingState({
  message = "Loading your workspace...",
  className,
}: RouteLoadingStateProps) {
  return (
    <div className={className ?? "flex h-[calc(100vh-64px)] items-center justify-center"}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/80">
        <Loader2 className="h-4 w-4 animate-spin text-white/60" />
        <span>{message}</span>
      </div>
    </div>
  );
}
