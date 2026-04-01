import { NextRequest, NextResponse } from "next/server";
import { AGENT_BUNDLES, AGENT_CATALOG, getAgentBundle, getAgentCatalogEntry } from "@/lib/agents/catalog";
import {
    clearProviderConnection,
    getAccessibleAgentIds,
    getConnectedBundleIds,
    getInstalledAgentIds,
    getProviderConnection,
    installAgentIds,
    uninstallAgentIds,
} from "@/lib/agents/user-access.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import type { AgentProvider } from "@/lib/agents/catalog";

export async function GET(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const providers = Array.from(
        new Set(
            AGENT_CATALOG.map((agent) => agent.provider).filter(
                (provider): provider is Exclude<AgentProvider, "internal"> => provider !== "internal"
            )
        )
    );

    const providerConnections = await Promise.all(
        providers.map(async (provider) => [
            provider,
            await getProviderConnection(verifiedUser.uid, provider),
        ] as const)
    );

    const [installedAgentIds, accessibleAgentIds, connectedBundleIds] = await Promise.all([
        getInstalledAgentIds(verifiedUser.uid),
        getAccessibleAgentIds(verifiedUser.uid),
        getConnectedBundleIds(verifiedUser.uid),
    ]);

    return NextResponse.json({
        agents: AGENT_CATALOG,
        bundles: AGENT_BUNDLES,
        installedAgentIds,
        accessibleAgentIds,
        connectedBundleIds,
        connections: Object.fromEntries(
            providerConnections.map(([provider, connection]) => [
                provider,
                Boolean(connection?.accessToken),
            ])
        ),
    });
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const action = String(body.action || "");
        const targetType = String(body.targetType || "agent");
        const targetId = String(body.targetId || "");

        if (!action || !targetId) {
            return NextResponse.json({ error: "action and targetId are required." }, { status: 400 });
        }

        if (targetType === "bundle") {
            const bundle = getAgentBundle(targetId);
            if (!bundle) {
                return NextResponse.json({ error: "Unknown bundle." }, { status: 404 });
            }

            if (action === "install") {
                const connection = await getProviderConnection(verifiedUser.uid, bundle.provider);
                if (!connection?.accessToken) {
                    return NextResponse.json(
                        {
                            error: "This bundle must be connected before it can be installed.",
                            oauthRequired: true,
                            bundleId: bundle.id,
                        },
                        { status: 409 }
                    );
                }

                await installAgentIds(verifiedUser.uid, bundle.childAgentIds);
                return NextResponse.json({ success: true, installedAgentIds: bundle.childAgentIds });
            }

            if (action === "uninstall") {
                await uninstallAgentIds(verifiedUser.uid, bundle.childAgentIds);
                await clearProviderConnection(verifiedUser.uid, bundle.provider);
                return NextResponse.json({ success: true, uninstalledAgentIds: bundle.childAgentIds });
            }

            return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
        }

        const agent = getAgentCatalogEntry(targetId);
        if (!agent) {
            return NextResponse.json({ error: "Unknown agent." }, { status: 404 });
        }

        if (action === "install") {
            if (agent.requiresConnection && agent.provider !== "internal") {
                const connection = await getProviderConnection(verifiedUser.uid, agent.provider);
                if (!connection?.accessToken) {
                    return NextResponse.json(
                        {
                            error: agent.bundleId
                                ? "This agent requires an authenticated bundle connection first."
                                : "This agent must be connected before it can be installed.",
                            oauthRequired: true,
                            bundleId: agent.bundleId ?? null,
                            agentId: agent.bundleId ? null : agent.id,
                        },
                        { status: 409 }
                    );
                }
            }

            await installAgentIds(verifiedUser.uid, [agent.id]);
            return NextResponse.json({ success: true, installedAgentIds: [agent.id] });
        }

        if (action === "uninstall") {
            await uninstallAgentIds(verifiedUser.uid, [agent.id]);
            if (agent.requiresConnection && !agent.bundleId && agent.provider !== "internal") {
                await clearProviderConnection(verifiedUser.uid, agent.provider);
            }
            return NextResponse.json({ success: true, uninstalledAgentIds: [agent.id] });
        }

        return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
    } catch (error) {
        console.error("[Agents API] error:", error);
        return NextResponse.json({ error: "Failed to update agent state." }, { status: 500 });
    }
}
