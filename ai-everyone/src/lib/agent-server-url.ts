// No safe default host: this must be explicitly configured.
const DEFAULT_AGENT_SERVER_URL = "";

function normalizeBaseUrl(value: string | undefined | null): string {
    const trimmed = (value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function resolveAgentServerUrl(explicitBaseUrl?: string): string {
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

