"use client";

import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
            <DialogContent className="max-w-md border border-white/10 bg-[#0C0D0D] p-5 text-white">
                <DialogHeader className="sr-only">
                    <DialogTitle>Drive Upload Sign-In</DialogTitle>
                </DialogHeader>
                <div className="mb-4">
                    <div>
                        <p className="text-sm font-semibold text-cyan-100">Drive Upload Sign-In</p>
                        <p className="mt-1 text-xs text-white/60">
                            Sign in to Google Drive for chat uploads only.
                        </p>
                    </div>
                </div>

                <div className="mb-4 rounded-lg border border-white/10 bg-[#0C0D0D] px-3 py-2 text-xs text-white/70">
                    This is separate from Agent connections. It only enables file picker access for
                    "Upload from Drive" in chat.
                </div>

                {authError ? (
                    <div className="mb-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {authError}
                    </div>
                ) : null}

                <button
                    type="button"
                    onClick={onSignIn}
                    disabled={isSigningIn || !isReady}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#0C0D0D] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#151616] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {isSigningIn ? "Signing in..." : "Sign in to Drive"}
                </button>
            </DialogContent>
        </Dialog>
    );
}
