import { NextRequest, NextResponse } from "next/server";

import { getInstallHintForAgent } from "@/lib/agents/catalog";
import { getAccessibleAgentIds, getInstalledAgentIds } from "@/lib/agents/user-access.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

const EMERGENCY_AGENT_ID = "emergency-response-agent";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const lat = Number(body?.lat);
        const lng = Number(body?.lng);
        const radius = Number(body?.radius || 5000);
        const description = typeof body?.description === "string" ? body.description : "";

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return NextResponse.json({ error: "lat and lng are required." }, { status: 400 });
        }

        const [installedIds, accessibleIds] = await Promise.all([
            getInstalledAgentIds(verifiedUser.uid),
            getAccessibleAgentIds(verifiedUser.uid),
        ]);

        if (!installedIds.includes(EMERGENCY_AGENT_ID)) {
            return NextResponse.json(
                { error: getInstallHintForAgent(EMERGENCY_AGENT_ID) },
                { status: 403 }
            );
        }

        if (!accessibleIds.includes(EMERGENCY_AGENT_ID)) {
            return NextResponse.json(
                { error: getInstallHintForAgent(EMERGENCY_AGENT_ID) },
                { status: 403 }
            );
        }

        const agentBaseUrl =
            process.env.EMERGENCY_RESPONSE_AGENT_URL ||
            process.env.AGENT_SERVER_URL ||
            "http://13.126.69.108";

        const response = await fetch(`${agentBaseUrl}/emergency/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: `emergency-escalate-${Date.now()}`,
                userId: verifiedUser.uid,
                agentId: EMERGENCY_AGENT_ID,
                action: "activate_emergency",
                description,
                lat,
                lng,
                radius: Number.isFinite(radius) ? radius : 5000,
            }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json(
                { error: payload?.error || `Emergency agent returned ${response.status}` },
                { status: response.status }
            );
        }

        return NextResponse.json(payload);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to activate emergency response.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
