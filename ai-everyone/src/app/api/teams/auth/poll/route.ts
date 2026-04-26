// src/app/api/teams/auth/poll/route.ts
import { NextResponse } from "next/server";
import { resolveAgentServerUrl } from "@/lib/agent-server-url";

export async function POST() {
    const agentServerUrl = resolveAgentServerUrl(
        process.env.TEAMS_AGENT_URL,
        "teams-agent"
    );
    const agentUrl = `${agentServerUrl}/auth/poll`;

    try {
        const response = await fetch(agentUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000),
        });

        const data = await response.json().catch(() => ({}));

        return NextResponse.json(data, { status: response.status });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Teams Auth Poll Proxy Error]", message);
        return NextResponse.json(
            { error: `Cannot reach agent server: ${message}` },
            { status: 502 }
        );
    }
}
