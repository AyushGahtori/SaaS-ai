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
      <div className="ui-surface content-fade-in flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>{message}</span>
      </div>
    </div>
  );
}
