"use client";

import { useMemo, useState } from "react";
import { Check, Link2, Loader2, Star } from "lucide-react";
import { auth } from "@/lib/firebase";

interface AgentInstallSuggestion {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    category: string;
    installCount: number;
    rating: number;
    requiresConnection: boolean;
    bundleId?: string;
    kind: "agent" | "bundle";
}

interface AgentInstallSuggestionCardProps {
    message?: string;
    suggestion: AgentInstallSuggestion;
}

async function getAuthHeaders() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
        throw new Error("Authentication expired. Please sign in again.");
    }

    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
    };
}

export function AgentInstallSuggestionCard({
    message,
    suggestion,
}: AgentInstallSuggestionCardProps) {
    const [busy, setBusy] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [installed, setInstalled] = useState(false);

    const buttonLabel = useMemo(() => {
        if (installed) return "Installed";
        return suggestion.requiresConnection || suggestion.kind === "bundle" ? "Connect & Install" : "Install";
    }, [installed, suggestion.kind, suggestion.requiresConnection]);

    const openConnectionPopup = async (target: { bundleId?: string; agentId?: string }) => {
        const headers = await getAuthHeaders();
        const response = await fetch("/api/agents/oauth/start", {
            method: "POST",
            headers,
            body: JSON.stringify(target),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.authUrl) {
            throw new Error(data.error || "Failed to start authorization.");
        }

        const popupOrigin =
            typeof data.popupOrigin === "string" && data.popupOrigin.length > 0
                ? data.popupOrigin
                : new URL(data.authUrl).origin;

        const popup = window.open(
            data.authUrl,
            `oauth-${target.bundleId || target.agentId || "agent"}`,
            "width=560,height=720,menubar=no,toolbar=no,location=yes,status=no"
        );
        if (!popup) {
            throw new Error("Popup blocked. Please allow popups and try again.");
        }

        await new Promise<void>((resolve, reject) => {
            let done = false;
            const timeout = window.setTimeout(() => {
                cleanup();
                reject(new Error("Authorization timed out. Please try again."));
            }, 180000);
            const interval = window.setInterval(() => {
                if (popup.closed && !done) {
                    cleanup();
                    reject(new Error("Authorization window was closed."));
                }
            }, 500);

            const onMessage = (event: MessageEvent) => {
                if (event.origin !== popupOrigin) return;
                if (!event.data || typeof event.data !== "object") return;

                const sameTarget =
                    (target.bundleId && event.data.bundleId === target.bundleId) ||
                    (target.agentId && event.data.agentId === target.agentId);

                if (event.data.type === "Pian_oauth_success" && sameTarget) {
                    done = true;
                    cleanup();
                    resolve();
                }
                if (event.data.type === "Pian_oauth_error" && sameTarget) {
                    done = true;
                    cleanup();
                    reject(new Error(event.data.message || "Connection failed."));
                }
            };

            const cleanup = () => {
                window.clearTimeout(timeout);
                window.clearInterval(interval);
                window.removeEventListener("message", onMessage);
            };

            window.addEventListener("message", onMessage);
        });
    };

    const installSuggestion = async () => {
        if (busy || installed) return;
        setBusy(true);
        setStatusMessage(null);
        try {
            const headers = await getAuthHeaders();
            const payload = {
                action: "install",
                targetId: suggestion.id,
                targetType: suggestion.kind,
            };

            let response = await fetch("/api/agents", {
                method: "POST",
                headers,
                body: JSON.stringify(payload),
            });
            let data = await response.json().catch(() => ({}));

            if (!response.ok && data.oauthRequired && (data.bundleId || data.agentId)) {
                await openConnectionPopup({
                    bundleId: data.bundleId || undefined,
                    agentId: data.agentId || undefined,
                });
                response = await fetch("/api/agents", {
                    method: "POST",
                    headers: await getAuthHeaders(),
                    body: JSON.stringify(payload),
                });
                data = await response.json().catch(() => ({}));
            }

            if (!response.ok) {
                throw new Error(data.error || "Could not install this agent from chat.");
            }

            setInstalled(true);
            setStatusMessage("Installed successfully. You can ask me to use it now.");
        } catch (error) {
            setStatusMessage(
                error instanceof Error ? error.message : "Could not install this agent."
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mt-3 space-y-3 rounded-xl border border-cyan-500/25 bg-[#0C0D0D] p-3">
            {message ? (
                <p className="text-sm text-white/85">{message}</p>
            ) : null}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#2b2b2b] p-1.5 ring-1 ring-white/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={suggestion.iconUrl} alt={suggestion.name} className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{suggestion.name}</p>
                        <p className="mt-0.5 text-xs capitalize text-white/50">{suggestion.category}</p>
                        <p className="mt-1.5 line-clamp-2 text-xs text-white/65">{suggestion.description}</p>
                        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/55">
                            <span className="inline-flex items-center gap-1">
                                <Star className="h-3 w-3 fill-white/40" />
                                {suggestion.rating.toFixed(1)}
                            </span>
                            <span>•</span>
                            <span>{(suggestion.installCount / 1000).toFixed(1)}K</span>
                        </div>
                    </div>
                </div>
                <div className="mt-3">
                    <button
                        onClick={() => void installSuggestion()}
                        disabled={busy || installed}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : installed ? (
                            <Check className="h-4 w-4" />
                        ) : suggestion.requiresConnection || suggestion.kind === "bundle" ? (
                            <Link2 className="h-4 w-4" />
                        ) : null}
                        {buttonLabel}
                    </button>
                </div>
                {statusMessage ? (
                    <p className="mt-2 text-xs text-white/70">{statusMessage}</p>
                ) : null}
            </div>
        </div>
    );
}

