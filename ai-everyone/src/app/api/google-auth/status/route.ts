/**
 * GET /api/google-auth/status
 *
 * Proxies the auth status check to the Python Google Agent server.
 * The GoogleLoginCard polls this endpoint to detect when the user
 * completes the OAuth flow in the other tab.
 */

import { NextResponse } from "next/server";

const GOOGLE_AGENT_URL = process.env.GOOGLE_AGENT_URL || "http://localhost:8300";

export async function GET() {
    try {
        const res = await fetch(`${GOOGLE_AGENT_URL}/auth/status`);
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ authenticated: false });
    }
}
