"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { UserFacingError } from "@/lib/errors/user-facing-errors";

interface ThemedErrorBannerProps {
    error: UserFacingError | null;
    className?: string;
    onRetry?: () => void;
    retryLabel?: string;
}

export function ThemedErrorBanner({
    error,
    className,
    onRetry,
    retryLabel = "Try again",
}: ThemedErrorBannerProps) {
    if (!error) return null;

    return (
        <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className={cn(
                "rounded-2xl border border-rose-300/20 bg-[linear-gradient(180deg,rgba(220,38,38,0.14),rgba(12,14,24,0.85))] px-4 py-3 text-rose-50 shadow-[0_14px_32px_rgb(0_0_0/30%)]",
                className
            )}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-200/25 bg-rose-500/15">
                    <AlertTriangle className="h-4 w-4 text-rose-100" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-5 text-rose-50">{error.title}</p>
                    <p className="mt-1 text-sm leading-5 text-rose-100/90">{error.message}</p>
                </div>

                {onRetry ? (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="shrink-0 border-rose-100/25 bg-rose-500/10 text-rose-50 hover:bg-rose-500/20 hover:text-rose-50"
                        onClick={onRetry}
                    >
                        <RefreshCcw className="h-3.5 w-3.5" />
                        {retryLabel}
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

