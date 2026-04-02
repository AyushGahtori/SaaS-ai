import { NextRequest, NextResponse } from "next/server";

import { getInstallHintForAgent } from "@/lib/agents/catalog";
import {
    getAccessibleAgentIds,
    getAgentExecutionAuth,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

const GOOGLE_AGENT_ID = "google-agent";

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const to = typeof body?.to === "string" ? body.to.trim() : "";
        const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
        const emailBody = typeof body?.body === "string" ? body.body.trim() : "";

        if (!to || !subject || !emailBody) {
            return NextResponse.json(
                { error: "to, subject, and body are required." },
                { status: 400 }
            );
        }

        const [installedIds, accessibleIds] = await Promise.all([
            getInstalledAgentIds(verifiedUser.uid),
            getAccessibleAgentIds(verifiedUser.uid),
        ]);

        if (!installedIds.includes(GOOGLE_AGENT_ID)) {
            return NextResponse.json(
                { error: getInstallHintForAgent(GOOGLE_AGENT_ID) },
                { status: 403 }
            );
        }

        if (!accessibleIds.includes(GOOGLE_AGENT_ID)) {
            return NextResponse.json(
                { error: getInstallHintForAgent(GOOGLE_AGENT_ID) },
                { status: 403 }
            );
        }

        const authPayload = await getAgentExecutionAuth(verifiedUser.uid, GOOGLE_AGENT_ID);
        const googleBaseUrl =
            process.env.GOOGLE_AGENT_URL ||
            process.env.AGENT_SERVER_URL ||
            "http://13.126.69.108";

        const gmailInstruction = `Send email to ${to}\nSubject: ${subject}\nBody: ${emailBody}`;

        const response = await fetch(`${googleBaseUrl}/google/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                taskId: `emergency-email-${Date.now()}`,
                userId: verifiedUser.uid,
                agentId: GOOGLE_AGENT_ID,
                agent_type: "gmail",
                action: "send",
                parameters: gmailInstruction,
                ...authPayload,
            }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return NextResponse.json(
                { error: payload?.error || `Google agent returned ${response.status}` },
                { status: response.status }
            );
        }

        if (payload?.status === "failed") {
            return NextResponse.json({ status: "failed", error: payload?.error || "Email send failed." });
        }

        if (payload?.status === "action_required") {
            return NextResponse.json({
                status: "failed",
                error: "Google connection is required for email sending. Connect Google Bundle first.",
            });
        }

        if (payload?.status === "needs_input") {
            return NextResponse.json({
                status: "failed",
                error: payload?.summary || "Gmail needs more details to send this email.",
            });
        }

        return NextResponse.json({ status: "success", result: payload });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to send emergency email.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
