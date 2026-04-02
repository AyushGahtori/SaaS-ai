/**
 * GET /api/microsoft-auth/callback
 *
 * OAuth bridge for local/dev web apps.
 * Microsoft may redirect to localhost callback while EC2 owns OAuth state + token persistence.
 * This route forwards code/state/error to detached EC2 callback endpoint.
 */

import { NextRequest, NextResponse } from "next/server";

const TEAMS_AGENT_URL =
    process.env.TEAMS_AGENT_URL ||
    process.env.AGENT_SERVER_URL ||
    "http://13.126.69.108";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const state = req.nextUrl.searchParams.get("state");
    const error = req.nextUrl.searchParams.get("error");

    if (!state) {
        return NextResponse.json({ error: "Missing OAuth state." }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set("state", state);
    if (code) params.set("code", code);
    if (error) params.set("error", error);

    const base = TEAMS_AGENT_URL.replace(/\/$/, "");
    return NextResponse.redirect(`${base}/teams/auth/callback?${params.toString()}`);
}

