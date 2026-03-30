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

const bundleUiMeta: Record<
    string,
    Omit<MarketplaceAgent, "id" | "name" | "description" | "category" | "tags" | "provider" | "kind" | "requiresConnection" | "childAgentIds">
> = {
    "google-bundle": {
        iconUrl: makeMonogramIcon("Google", "#0F9D58", "#4285F4"),
        installCount: 28400,
        rating: 4.9,
        createdAt: "2026-03-01T00:00:00.000Z",
        isFeatured: true,
        trendingScore: 980,
        featuredRank: 0,
    },
    "microsoft-bundle": {
        iconUrl: makeMonogramIcon("M365", "#0ea5e9", "#1d4ed8"),
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
        iconUrl: makeMonogramIcon("Todo", "#f59e0b", "#ea580c"),
        installCount: 19400,
        rating: 4.9,
        createdAt: "2026-03-03T00:00:00.000Z",
        isFeatured: true,
        trendingScore: 910,
        featuredRank: 2,
    },
    "google-agent": {
        iconUrl: makeMonogramIcon("Gmail", "#16a34a", "#0f766e"),
        installCount: 17600,
        rating: 4.8,
        createdAt: "2026-03-05T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 870,
    },
    "maps-agent": {
        iconUrl: makeMonogramIcon("Maps", "#f97316", "#ea580c"),
        installCount: 16500,
        rating: 4.8,
        createdAt: "2026-03-06T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 860,
    },
    "notion-agent": {
        iconUrl: makeMonogramIcon("Notion", "#111827", "#374151"),
        installCount: 15400,
        rating: 4.7,
        createdAt: "2026-03-07T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 850,
    },
    "email-agent": {
        iconUrl: makeMonogramIcon("Mail", "#2563eb", "#1e3a8a"),
        installCount: 15800,
        rating: 4.7,
        createdAt: "2026-03-08T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 840,
    },
    "calendar-agent": {
        iconUrl: makeMonogramIcon("Cal", "#14b8a6", "#0f766e"),
        installCount: 14900,
        rating: 4.7,
        createdAt: "2026-03-09T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 810,
    },
    "teams-agent": {
        iconUrl: makeMonogramIcon("Teams", "#7c3aed", "#4f46e5"),
        installCount: 14300,
        rating: 4.6,
        createdAt: "2026-03-10T00:00:00.000Z",
        isFeatured: false,
        trendingScore: 790,
    },
};

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
    const meta = agentUiMeta[agent.id];
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
