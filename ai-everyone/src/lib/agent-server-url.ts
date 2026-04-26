import {
    getAgentPrefix,
    getDeveloper,
} from "@/lib/api";

// No safe default host: this must be explicitly configured.
const DEFAULT_AGENT_SERVER_URL = "";

function normalizeBaseUrl(value: string | undefined | null): string {
    const trimmed = (value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function resolveAgentServerUrl(
    explicitBaseUrl?: string,
    agentId?: string
): string {
    const dev = getDeveloper();
    if (dev !== "prod") {
        const previewBase =
            normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE) ||
            normalizeBaseUrl(process.env.AGENT_SERVER_URL);
        if (previewBase) {
            return `${previewBase}${getAgentPrefix(dev)}`;
        }

        throw new Error(
            "Developer agent routing is active, but NEXT_PUBLIC_API_BASE is not configured."
        );
    }

    const resolved =
        normalizeBaseUrl(explicitBaseUrl) ||
        normalizeBaseUrl(process.env.AGENT_SERVER_URL) ||
        normalizeBaseUrl(DEFAULT_AGENT_SERVER_URL);

    if (!resolved) {
        throw new Error(
            "Agent server URL is not configured. Set AGENT_SERVER_URL or the relevant per-agent env var."
        );
    }

    return resolved;
}

