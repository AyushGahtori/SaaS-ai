import { NextRequest, NextResponse } from "next/server";

import { buildEc2OauthLaunch } from "@/lib/agents/ec2-oauth.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const bundleId = typeof body.bundleId === "string" ? body.bundleId : undefined;
        const agentId = typeof body.agentId === "string" ? body.agentId : undefined;

        const { authUrl, popupOrigin } = buildEc2OauthLaunch(req, verifiedUser.uid, {
            bundleId,
            agentId,
        });

        return NextResponse.json({ authUrl, popupOrigin });
    } catch (error) {
        console.error("[EC2 OAuth Start] error:", error);
        const message =
            error instanceof Error ? error.message : "Failed to start detached EC2 OAuth.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
