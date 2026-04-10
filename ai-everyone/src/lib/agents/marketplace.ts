import {
    AGENT_BUNDLES,
    AGENT_CATALOG,
    type AgentBundle,
    type AgentCatalogEntry,
} from "@/lib/agents/catalog";

export interface MarketplaceAgent {
    id: string;
    name: string;
    description: string;
    iconUrl: string;
    category: string;
    installCount: number;
    rating: number;
    createdAt: string;
    isFeatured: boolean;
    trendingScore: number;
    tags?: string[];
    kind: "agent" | "bundle";
    provider: string;
    requiresConnection: boolean;
    bundleId?: string;
    childAgentIds?: string[];
    featuredRank?: number;
}

function makeMonogramIcon(label: string, from: string, to: string): string {
    const safeLabel = label.slice(0, 10);
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}" />
          <stop offset="100%" stop-color="${to}" />
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="28" fill="url(#g)" />
      <rect x="8" y="8" width="112" height="112" rx="22" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.16)" />
      <text x="64" y="74" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="700" text-anchor="middle" fill="white">${safeLabel}</text>
    </svg>`;

    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function localIcon(fileName: string): string {
    return `/marketplace/icons/${fileName}`;
}

const bundleUiMeta: Record<
    string,
    Omit<MarketplaceAgent, "id" | "name" | "description" | "category" | "tags" | "provider" | "kind" | "requiresConnection" | "childAgentIds">
> = {
    "google-bundle": {
        iconUrl: localIcon("google.png"),
        installCount: 28400,
        rating: 4.9,
        createdAt: "2026-03-01T00:00:00.000Z",
        isFeatured: true,
        trendingScore: 980,
        featuredRank: 0,
    },
    "microsoft-bundle": {
        iconUrl: localIcon("microsoft.png"),
        installCount: 23100,
        rating: 4.8,
        createdAt: "2026-03-01T00:00:00.000Z",
        isFeatured: true,
        trendingScore: 940,
        featuredRank: 1,
    },
};

const agentUiMeta: Record<
    string,
    Omit<MarketplaceAgent, "id" | "name" | "description" | "category" | "tags" | "provider" | "kind" | "requiresConnection" | "bundleId">
> = {
    "todo-agent": {
        iconUrl: localIcon("todo.png"),
        installCount: 19400,
        rating: 4.9,
        createdAt: "2026-03-03T00:00:00.000Z",
        isFeatured: true,
        trendingScore: 910,
        featuredRank: 2,
    },
    "google-agent": {
        iconUrl: localIcon("google.png"),
        installCount: 17600,
        rating: 4.8,
        createdAt: "2026-03-05T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 870,
    },
    "maps-agent": {
        iconUrl: localIcon("maps.png"),
        installCount: 16500,
        rating: 4.8,
        createdAt: "2026-03-06T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 860,
    },
    "emergency-response-agent": {
        iconUrl: localIcon("emergency.png"),
        installCount: 9600,
        rating: 4.7,
        createdAt: "2026-04-02T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 845,
    },
    "strata-agent": {
        iconUrl: localIcon("stara.png"),
        installCount: 10200,
        rating: 4.7,
        createdAt: "2026-04-03T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 835,
    },
    "notion-agent": {
        iconUrl: localIcon("notion.png"),
        installCount: 15400,
        rating: 4.7,
        createdAt: "2026-03-07T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 850,
    },
    "email-agent": {
        iconUrl: localIcon("outlook.png"),
        installCount: 15800,
        rating: 4.7,
        createdAt: "2026-03-08T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 840,
    },
    "calendar-agent": {
        iconUrl: localIcon("calendar.png"),
        installCount: 14900,
        rating: 4.7,
        createdAt: "2026-03-09T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 810,
    },
    "teams-agent": {
        iconUrl: localIcon("teams.png"),
        installCount: 14300,
        rating: 4.6,
        createdAt: "2026-03-10T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 790,
    },
    "canva-agent": {
        iconUrl: localIcon("canva.png"),
        installCount: 11800,
        rating: 4.5,
        createdAt: "2026-03-11T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 760,
    },
    "day-planner-agent": {
        iconUrl: makeMonogramIcon("Plan", "#f59e0b", "#f97316"),
        installCount: 11200,
        rating: 4.6,
        createdAt: "2026-03-12T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 750,
    },
    "discord-agent": {
        iconUrl: localIcon("discord.png"),
        installCount: 10800,
        rating: 4.5,
        createdAt: "2026-03-13T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 740,
    },
    "dropbox-agent": {
        iconUrl: localIcon("dropbox.png"),
        installCount: 10300,
        rating: 4.5,
        createdAt: "2026-03-14T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 735,
    },
    "freshdesk-agent": {
        iconUrl: makeMonogramIcon("Desk", "#14b8a6", "#0f766e"),
        installCount: 9800,
        rating: 4.4,
        createdAt: "2026-03-15T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 720,
    },
    "github-agent": {
        iconUrl: localIcon("github.png"),
        installCount: 12700,
        rating: 4.7,
        createdAt: "2026-03-16T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 800,
    },
    "gitlab-agent": {
        iconUrl: localIcon("gitlab.png"),
        installCount: 9700,
        rating: 4.5,
        createdAt: "2026-03-17T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 710,
    },
    "greenhouse-agent": {
        iconUrl: makeMonogramIcon("Hire", "#22c55e", "#15803d"),
        installCount: 8900,
        rating: 4.4,
        createdAt: "2026-03-18T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 700,
    },
    "jira-agent": {
        iconUrl: localIcon("jira.png"),
        installCount: 11900,
        rating: 4.6,
        createdAt: "2026-03-19T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 780,
    },
    "linkedin-agent": {
        iconUrl: localIcon("linkedin.png"),
        installCount: 8600,
        rating: 4.3,
        createdAt: "2026-03-20T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 690,
    },
    "zoom-agent": {
        iconUrl: localIcon("zoom.png"),
        installCount: 12100,
        rating: 4.6,
        createdAt: "2026-03-21T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 770,
    },
    "dia-helper-agent": {
        iconUrl: makeMonogramIcon("Dia", "#22c55e", "#16a34a"),
        installCount: 4200,
        rating: 4.7,
        createdAt: "2026-04-07T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 730,
    },
    "shopgenie-agent": {
        iconUrl: makeMonogramIcon("Shop", "#f59e0b", "#ea580c"),
        installCount: 3900,
        rating: 4.6,
        createdAt: "2026-04-07T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 725,
    },
    "career-switch-agent": {
        iconUrl: makeMonogramIcon("CS", "#06b6d4", "#0891b2"),
        installCount: 2800,
        rating: 4.8,
        createdAt: "2026-04-08T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 715,
    },
    "startup-fundraising-agent": {
        iconUrl: makeMonogramIcon("Fund", "#4b635a", "#7c8f86"),
        installCount: 2600,
        rating: 4.7,
        createdAt: "2026-04-09T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 714,
    },
    "smart-gtm-agent": {
        iconUrl: makeMonogramIcon("GTM", "#3a5a67", "#557d86"),
        installCount: 2500,
        rating: 4.7,
        createdAt: "2026-04-09T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 713,
    },
    "seo-agent": {
        iconUrl: makeMonogramIcon("SEO", "#4f6b58", "#718574"),
        installCount: 2450,
        rating: 4.6,
        createdAt: "2026-04-09T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 712,
    },
    "dashboard-designer-agent": {
        iconUrl: makeMonogramIcon("Dash", "#446174", "#658296"),
        installCount: 2700,
        rating: 4.8,
        createdAt: "2026-04-09T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 716,
    },
    "ats-agent": {
        iconUrl: makeMonogramIcon("ATS", "#4b5a74", "#6a7891"),
        installCount: 2100,
        rating: 4.7,
        createdAt: "2026-04-10T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 717,
    },
};

function makeDefaultAgentMeta(agent: AgentCatalogEntry) {
    const label = agent.name.split(" ")[0] || agent.id;
    return {
        iconUrl: makeMonogramIcon(label, "#334155", "#0f172a"),
        installCount: 8200,
        rating: 4.4,
        createdAt: "2026-03-31T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 640,
    };
}

function toBundleItem(bundle: AgentBundle): MarketplaceAgent {
    const meta = bundleUiMeta[bundle.id];
    return {
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        category: bundle.category,
        tags: bundle.tags,
        provider: bundle.provider,
        kind: "bundle",
        requiresConnection: true,
        childAgentIds: bundle.childAgentIds,
        ...meta,
    };
}

function toAgentItem(agent: AgentCatalogEntry): MarketplaceAgent {
    const meta = agentUiMeta[agent.id] ?? makeDefaultAgentMeta(agent);
    return {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        category: agent.category,
        tags: agent.tags,
        provider: agent.provider,
        kind: "agent",
        requiresConnection: agent.requiresConnection,
        bundleId: agent.bundleId,
        ...meta,
    };
}

export const MARKETPLACE_AGENTS: MarketplaceAgent[] = [
    ...AGENT_BUNDLES.map(toBundleItem),
    ...AGENT_CATALOG.map(toAgentItem),
];

export async function getMarketplaceAgents(): Promise<MarketplaceAgent[]> {
    return [...MARKETPLACE_AGENTS].sort((left, right) =>
        right.trendingScore - left.trendingScore || left.name.localeCompare(right.name)
    );
}

export async function getMarketplaceFeaturedAgents(): Promise<MarketplaceAgent[]> {
    return MARKETPLACE_AGENTS.filter((agent) => agent.isFeatured).sort(
        (left, right) => (left.featuredRank ?? 99) - (right.featuredRank ?? 99)
    );
}

export async function getMarketplaceTrendingAgents(count = 10): Promise<MarketplaceAgent[]> {
    return [...MARKETPLACE_AGENTS]
        .sort((left, right) => right.trendingScore - left.trendingScore)
        .slice(0, count);
}

export async function getMarketplaceAgentById(agentId: string): Promise<MarketplaceAgent | null> {
    return MARKETPLACE_AGENTS.find((agent) => agent.id === agentId) ?? null;
}
