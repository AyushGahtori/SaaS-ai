const DEFAULT_AGENT_SERVER_URL = "https://your-default-host";

function normalizeBaseUrl(value: string | undefined | null): string {
    const trimmed = (value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function resolveAgentServerUrl(explicitBaseUrl?: string): string {
    return (
        normalizeBaseUrl(explicitBaseUrl) ||
        normalizeBaseUrl(process.env.AGENT_SERVER_URL) ||
        DEFAULT_AGENT_SERVER_URL
    );
}

