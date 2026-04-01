/**
 * GET /api/google-auth/status
 *
 * Proxies the auth status check to the Google Agent service URL.
 * The GoogleLoginCard polls this endpoint to detect when the user
 * completes the OAuth flow in the other tab.
 */

import { NextResponse } from "next/server";

const GOOGLE_AGENT_URL = process.env.GOOGLE_AGENT_URL || "http://13.126.69.108";

export async function GET() {
    try {
        const base = GOOGLE_AGENT_URL.replace(/\/$/, "");
        const primary = await fetch(`${base}/google/auth/status`);
        const res = primary.status === 404 ? await fetch(`${base}/auth/status`) : primary;
        const data = await res.json();
        return NextResponse.json(data);
    } catch {
        return NextResponse.json({ authenticated: false });
    }
}
