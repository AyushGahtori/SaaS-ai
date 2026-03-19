// src/app/api/teams/auth/poll/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    // Process env AGENT_SERVER_URL matching firestore-tasks.server.ts
    const agentServerUrl = process.env.AGENT_SERVER_URL || "http://host.docker.internal:8100";
    const agentUrl = `${agentServerUrl}/auth/poll`;

    try {
        const response = await fetch(agentUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json().catch(() => ({}));
        
        return NextResponse.json(data, { status: response.status });
    } catch (error: any) {
        console.error("[Teams Auth Poll Proxy Error]", error.message);
        return NextResponse.json(
            { error: `Cannot reach agent server: ${error.message}` },
            { status: 502 }
        );
    }
}
