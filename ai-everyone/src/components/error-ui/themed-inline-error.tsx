"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserFacingError } from "@/lib/errors/user-facing-errors";

interface ThemedInlineErrorProps {
    error: UserFacingError | null;
    className?: string;
}

export function ThemedInlineError({ error, className }: ThemedInlineErrorProps) {
    if (!error) return null;

    return (
        <div
            className={cn(
                "inline-flex max-w-full items-start gap-2 rounded-xl border border-rose-300/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100",
                className
            )}
            role="status"
            aria-live="polite"
        >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span className="leading-5">{error.message}</span>
        </div>
    );
}

