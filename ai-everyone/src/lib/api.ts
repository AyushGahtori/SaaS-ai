export type AgentEnvironment = "prod" | "aaron" | "agamya" | "naveen" | "gunjan";

export const AGENT_ENVIRONMENTS: Exclude<AgentEnvironment, "prod">[] = [
    "aaron",
    "agamya",
    "naveen",
    "gunjan",
];

export const AGENT_BASE_PORTS: Record<string, number> = {
    "teams-agent": 8100,
    "email-agent": 8100,
    "calendar-agent": 8100,
    "todo-agent": 8200,
    "google-agent": 8300,
    "notion-agent": 8400,
    "maps-agent": 8500,
    "emergency-response-agent": 8510,
    "strata-agent": 8012,
    "canva-agent": 8001,
    "day-planner-agent": 8002,
    "discord-agent": 8003,
    "dropbox-agent": 8004,
    "freshdesk-agent": 8005,
    "github-agent": 8006,
    "gitlab-agent": 8007,
    "greenhouse-agent": 8008,
    "jira-agent": 8009,
    "linkedin-agent": 8010,
    "zoom-agent": 8011,
    "dia-helper-agent": 8020,
    "shopgenie-agent": 8021,
    "career-switch-agent": 8022,
    "dashboard-designer-agent": 8024,
    "smart-gtm-agent": 8033,
    "seo-agent": 8034,
    "startup-fundraising-agent": 8035,
    "ats-agent": 8036,
    "building-construction-agent": 8037,
    "lms-agent": 8039,
    "travel-halper-agent": 8040,
    "devika-engineer-agent": 8041,
    "data-analyst-agent": 8042,
    "cyber-soc-agent": 8043,
};

export function getBranchName(): string {
    return (
        process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF ||
        process.env.VERCEL_GIT_COMMIT_REF ||
        process.env.NEXT_PUBLIC_LOCAL_BRANCH ||
        process.env.LOCAL_BRANCH ||
        ""
    );
}

export function getDeveloper(branch = getBranchName()): AgentEnvironment {
    if (branch.startsWith("aaron/")) return "aaron";
    if (branch.startsWith("agamya/")) return "agamya";
    if (branch.startsWith("naveen/")) return "naveen";
    if (branch.startsWith("gunjan/")) return "gunjan";
    return "prod";
}

export function getAgentPrefix(dev = getDeveloper()): string {
    if (dev === "prod") return "/api";
    return `/api/${dev}`;
}

export function mapPort(basePort: number, dev = getDeveloper()): number {
    if (dev === "aaron") return basePort + 1000;
    if (dev === "agamya") return basePort + 1100;
    if (dev === "naveen") return basePort + 1200;
    if (dev === "gunjan") return basePort + 1300;
    return basePort;
}

export function getAgentBasePort(agentId: string): number | undefined {
    return AGENT_BASE_PORTS[agentId];
}

export function isLocalRuntime(hostname?: string): boolean {
    const browserHostname =
        typeof window !== "undefined" ? window.location.hostname : undefined;
    const resolvedHostname = hostname || browserHostname || "";

    if (
        resolvedHostname === "localhost" ||
        resolvedHostname === "127.0.0.1" ||
        resolvedHostname === "::1"
    ) {
        return true;
    }

    return typeof window === "undefined" && process.env.NODE_ENV === "development";
}

function trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, "");
}

function normalizeBaseUrl(value: string | undefined | null): string {
    const trimmed = (value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
}

export function getAgentApiUrl(
    agentSlug: string,
    _basePort: number,
    options: {
        apiBase?: string;
        branch?: string;
        hostname?: string;
    } = {}
): string {
    void _basePort;
    const dev = getDeveloper(options.branch);
    const slug = trimSlashes(agentSlug);

    const base =
        normalizeBaseUrl(options.apiBase) ||
        normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE);

    if (!base) {
        throw new Error("NEXT_PUBLIC_API_BASE is not configured.");
    }

    return `${base}${getAgentPrefix(dev)}/${slug}`;
}
