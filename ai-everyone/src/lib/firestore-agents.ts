// Marketplace catalog helpers.
//
// Historically this file read the `agents` Firestore collection. SnitchX now
// uses a curated in-repo catalog backed by real agent implementations and
// bundle definitions, while per-user install/auth state still lives in
// Firestore.

import {
    getMarketplaceAgentById,
    getMarketplaceAgents,
    getMarketplaceFeaturedAgents,
    getMarketplaceTrendingAgents,
    type MarketplaceAgent,
} from "@/lib/agents/marketplace";

export type Agent = MarketplaceAgent;

export async function getAllAgents(): Promise<Agent[]> {
    return getMarketplaceAgents();
}

export async function getAgentById(agentId: string): Promise<Agent | null> {
    return getMarketplaceAgentById(agentId);
}

export async function getFeaturedAgents(): Promise<Agent[]> {
    return getMarketplaceFeaturedAgents();
}

export async function getTrendingAgents(count: number = 10): Promise<Agent[]> {
    return getMarketplaceTrendingAgents(count);
}

export async function upsertAgent(_agentId: string, _data: Omit<Agent, "id">): Promise<void> {
    return;
}

export async function incrementInstallCount(_agentId: string): Promise<void> {
    return;
}

export async function decrementInstallCount(_agentId: string): Promise<void> {
    return;
}
