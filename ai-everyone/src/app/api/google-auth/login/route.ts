/**
 * GET /api/google-auth/login
 *
 * Redirects the user's browser to Google's OAuth consent screen.
 * The redirect_uri points back to /api/google-auth/callback (on port 3000),
 * which is accessible from the host machine.
 */

import { NextResponse } from "next/server";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/contacts.readonly",
].join(" ");

// This callback must be on port 3000 (Next.js) since it's browser-accessible
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google-auth/callback";

export async function GET() {
    if (!GOOGLE_CLIENT_ID) {
        return NextResponse.json({ error: "GOOGLE_CLIENT_ID not configured" }, { status: 500 });
    }

    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "code",
        scope: SCOPES,
        access_type: "offline",
        prompt: "consent",
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.redirect(authUrl);
}
