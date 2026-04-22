// src/app/api/teams/auth/poll/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const configuredBase = (process.env.AGENT_SERVER_URL || "").trim().replace(/\/+$/, "");
    // Keep detached EC2 fallback for Vercel/serverless environments.
    const agentServerUrl = configuredBase || "http://35.154.54.246";
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
