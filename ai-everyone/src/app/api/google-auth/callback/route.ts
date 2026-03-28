/**
 * GET /api/google-auth/callback
 *
 * Google redirects here after the user grants consent.
 * This route forwards the authorization code to the Google Agent's
 * Python server (running on localhost:8300 inside Docker) to exchange
 * it for access + refresh tokens.
 */

import { NextRequest } from "next/server";

const GOOGLE_AGENT_URL = process.env.GOOGLE_AGENT_URL || "http://localhost:8300";

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");

    if (error) {
        return new Response(
            `<html><body style="background:#111;color:#f55;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                <div style="text-align:center">
                    <h2>❌ Google Auth Error</h2>
                    <p>${error}</p>
                    <p style="color:#888">Close this tab and try again.</p>
                </div>
            </body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } }
        );
    }

    if (!code) {
        return new Response(
            `<html><body style="background:#111;color:#f55;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                <div style="text-align:center">
                    <h2>❌ Missing authorization code</h2>
                    <p style="color:#888">Close this tab and try again.</p>
                </div>
            </body></html>`,
            { status: 400, headers: { "Content-Type": "text/html" } }
        );
    }

    // Forward the code to the Python Google Agent server to exchange for tokens
    try {
        const res = await fetch(`${GOOGLE_AGENT_URL}/auth/callback?code=${encodeURIComponent(code)}`);
        const body = await res.text();

        if (res.ok) {
            return new Response(
                `<html><body style="background:#111;color:#4f4;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                    <div style="text-align:center">
                        <h2>✅ Google account connected!</h2>
                        <p style="color:#ccc">You can close this tab and go back to SnitchX.</p>
                        <script>setTimeout(()=>window.close(),3000)</script>
                    </div>
                </body></html>`,
                { status: 200, headers: { "Content-Type": "text/html" } }
            );
        } else {
            return new Response(
                `<html><body style="background:#111;color:#f55;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                    <div style="text-align:center">
                        <h2>❌ Token exchange failed</h2>
                        <p style="color:#888">${body}</p>
                    </div>
                </body></html>`,
                { status: 500, headers: { "Content-Type": "text/html" } }
            );
        }
    } catch (err) {
        return new Response(
            `<html><body style="background:#111;color:#f55;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
                <div style="text-align:center">
                    <h2>❌ Cannot reach Google Agent</h2>
                    <p style="color:#888">Is the Python server running on port 8300?</p>
                    <p style="color:#666">${err instanceof Error ? err.message : "Unknown error"}</p>
                </div>
            </body></html>`,
            { status: 502, headers: { "Content-Type": "text/html" } }
        );
    }
}
