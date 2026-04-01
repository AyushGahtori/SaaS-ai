import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
    getAgentCatalogEntry,
    getAgentBundle,
    getBundleForAgent,
    type AgentProvider,
} from "@/lib/agents/catalog";

export interface ProviderConnection {
    provider: AgentProvider;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number | null;
    scopes: string[];
    metadata?: Record<string, string | null>;
    connectedAt?: unknown;
    bundleId?: string | null;
}

const userDoc = (uid: string) => adminDb.collection("users").doc(uid);
const providerConnectionDoc = (uid: string, provider: string) =>
    userDoc(uid).collection("providerConnections").doc(provider);

export async function ensureUserDoc(uid: string): Promise<void> {
    await userDoc(uid).set({ lastSeenAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function getInstalledAgentIds(uid: string): Promise<string[]> {
    const snapshot = await userDoc(uid).get();
    if (!snapshot.exists) return [];
    const data = snapshot.data();
    return Array.isArray(data?.installedAgents) ? (data?.installedAgents as string[]) : [];
}

export async function getConnectedBundleIds(uid: string): Promise<string[]> {
    const snapshot = await userDoc(uid).get();
    if (!snapshot.exists) return [];
    const data = snapshot.data();
    return Array.isArray(data?.connectedBundles) ? (data?.connectedBundles as string[]) : [];
}

export async function installAgentIds(uid: string, agentIds: string[]): Promise<void> {
    if (agentIds.length === 0) return;
    await ensureUserDoc(uid);
    await userDoc(uid).set(
        {
            installedAgents: FieldValue.arrayUnion(...agentIds),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

export async function uninstallAgentIds(uid: string, agentIds: string[]): Promise<void> {
    if (agentIds.length === 0) return;
    await ensureUserDoc(uid);
    await userDoc(uid).set(
        {
            installedAgents: FieldValue.arrayRemove(...agentIds),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );
}

export async function saveProviderConnection(
    uid: string,
    provider: Exclude<AgentProvider, "internal">,
    data: {
        accessToken: string;
        refreshToken?: string | null;
        expiresAt?: number | null;
        scopes?: string[];
        metadata?: Record<string, string | null>;
        bundleId?: string | null;
    }
): Promise<void> {
    await ensureUserDoc(uid);
    await providerConnectionDoc(uid, provider).set(
        {
            provider,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken ?? null,
            expiresAt: data.expiresAt ?? null,
            scopes: data.scopes ?? [],
            metadata: data.metadata ?? {},
            bundleId: data.bundleId ?? null,
            connectedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
    );

    if (data.bundleId) {
        await userDoc(uid).set(
            {
                connectedBundles: FieldValue.arrayUnion(data.bundleId),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
}

export async function getProviderConnection(
    uid: string,
    provider: Exclude<AgentProvider, "internal">
): Promise<ProviderConnection | null> {
    const snapshot = await providerConnectionDoc(uid, provider).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data();
    if (!data?.accessToken) return null;

    return {
        provider,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? null,
        expiresAt: typeof data.expiresAt === "number" ? data.expiresAt : null,
        scopes: Array.isArray(data.scopes) ? data.scopes : [],
        metadata:
            data.metadata && typeof data.metadata === "object"
                ? (data.metadata as Record<string, string | null>)
                : {},
        connectedAt: data.connectedAt,
        bundleId: data.bundleId ?? null,
    };
}

export async function clearProviderConnection(
    uid: string,
    provider: Exclude<AgentProvider, "internal">
): Promise<void> {
    const existing = await providerConnectionDoc(uid, provider).get().catch(() => null);
    const bundleId =
        existing && existing.exists && typeof existing.data()?.bundleId === "string"
            ? (existing.data()?.bundleId as string)
            : null;

    await providerConnectionDoc(uid, provider).delete().catch(() => undefined);

    if (bundleId) {
        await userDoc(uid).set(
            {
                connectedBundles: FieldValue.arrayRemove(bundleId),
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );
    }
}

export async function isAgentInstalled(uid: string, agentId: string): Promise<boolean> {
    const installedIds = await getInstalledAgentIds(uid);
    return installedIds.includes(agentId);
}

export async function getAgentExecutionAuth(uid: string, agentId: string): Promise<{
    access_token?: string;
    refresh_token?: string;
    urn?: string;
    domain?: string;
}> {
    const agent = getAgentCatalogEntry(agentId);
    if (!agent || agent.provider === "internal") {
        return {};
    }

    const connection = await getProviderConnection(uid, agent.provider);
    if (connection) {
        return {
            access_token: connection.accessToken,
            ...(connection.refreshToken ? { refresh_token: connection.refreshToken } : {}),
            ...(connection.metadata?.urn ? { urn: connection.metadata.urn } : {}),
            ...(connection.metadata?.domain ? { domain: connection.metadata.domain } : {}),
        };
    }

    if (agentId === "freshdesk-agent" && process.env.FRESHDESK_API_KEY) {
        return {
            access_token: process.env.FRESHDESK_API_KEY,
            ...(process.env.FRESHDESK_DOMAIN ? { domain: process.env.FRESHDESK_DOMAIN } : {}),
        };
    }

    if (agentId === "greenhouse-agent" && process.env.GREENHOUSE_API_KEY) {
        return { access_token: process.env.GREENHOUSE_API_KEY };
    }

    return {};
}

export async function getAccessibleAgentIds(uid: string): Promise<string[]> {
    const installedIds = await getInstalledAgentIds(uid);
    if (installedIds.length === 0) return [];

    const result: string[] = [];
    for (const agentId of installedIds) {
        const agent = getAgentCatalogEntry(agentId);
        if (!agent) continue;
        if (!agent.requiresConnection || agent.provider === "internal") {
            result.push(agentId);
            continue;
        }

        const connection = await getProviderConnection(uid, agent.provider);
        if (connection?.accessToken) {
            result.push(agentId);
        }
    }

    return result;
}

export function getBundleInstallTargets(bundleId: string): string[] {
    return getAgentBundle(bundleId)?.childAgentIds ?? [];
}

export function getBundleIdForAgent(agentId: string): string | null {
    return getBundleForAgent(agentId)?.id ?? null;
}
