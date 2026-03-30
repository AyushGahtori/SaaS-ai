/**
 * GET /api/google-auth/login
 *
 * Redirects the user's browser to Google's OAuth consent screen.
 * The redirect_uri points back to /api/google-auth/callback (on port 3000),
 * which is accessible from the host machine.
 */

import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts.readonly",
].join(" ");

const CALLBACK_PATH = "/api/google-auth/callback";

function getRedirectUri(req: NextRequest): string {
    const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (configured && configured.includes(CALLBACK_PATH)) {
        return configured;
    }

    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
    const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;

    return `${proto}://${host}${CALLBACK_PATH}`;
}

export async function GET(req: NextRequest) {
    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
    }

    const redirectUri = getRedirectUri(req);

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(authUrl);
}
