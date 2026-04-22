"use client";

import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ThemedInlineError } from "@/components/error-ui/themed-inline-error";
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";

interface DriveUploadSigninOverlayProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isSigningIn: boolean;
    isReady: boolean;
    authError?: string | null;
    onSignIn: () => void;
}

export function DriveUploadSigninOverlay({
    open,
    onOpenChange,
    isSigningIn,
    isReady,
    authError,
    onSignIn,
}: DriveUploadSigninOverlayProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md p-5 text-white">
                <DialogHeader className="sr-only">
                    <DialogTitle>Drive Upload Sign-In</DialogTitle>
                </DialogHeader>
                <div className="mb-4">
                    <div>
                        <p className="text-sm font-semibold text-violet-100">Drive Upload Sign-In</p>
                        <p className="mt-1 text-xs text-white/60">
                            Sign in to Google Drive for chat uploads only.
                        </p>
                    </div>
                </div>

                <div className="ui-surface mb-4 rounded-lg px-3 py-2 text-xs text-white/70">
                    This is separate from Agent connections. It only enables file picker access for
                    &quot;Upload from Drive&quot; in chat.
                </div>

                {authError ? (
                    <ThemedInlineError
                        className="mb-4 w-full"
                        error={normalizeUserFacingError(authError, { surface: "upload" })}
                    />
                ) : null}

                <button
                    type="button"
                    onClick={onSignIn}
                    disabled={isSigningIn || !isReady}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-[0_10px_24px_rgb(107_76_255/34%)] transition hover:bg-primary/95 hover:shadow-[0_14px_28px_rgb(107_76_255/40%)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSigningIn ? "Signing in..." : "Sign in to Drive"}
                </button>
            </DialogContent>
        </Dialog>
    );
}
