/**
 * GET /api/google-auth/callback
 *
 * Google redirects here after the user grants consent.
 * This route forwards the authorization code to the Google Agent
 * service URL to exchange
 * it for access + refresh tokens.
 */

import { NextRequest } from "next/server";

const GOOGLE_AGENT_URL = process.env.GOOGLE_AGENT_URL || "http://13.126.69.108";
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

async function forwardCodeToAgent(code: string, redirectUri: string): Promise<Response> {
    const encodedCode = encodeURIComponent(code);
    const encodedRedirectUri = encodeURIComponent(redirectUri);
    const base = GOOGLE_AGENT_URL.replace(/\/$/, "");

    const candidateUrls = [
        `${base}/google/auth/callback?code=${encodedCode}&redirect_uri=${encodedRedirectUri}`,
        `${base}/auth/callback?code=${encodedCode}&redirect_uri=${encodedRedirectUri}`,
    ];

    let lastResponse: Response | null = null;
    for (const url of candidateUrls) {
        const res = await fetch(url);
        if (res.status !== 404) {
            return res;
        }
        lastResponse = res;
    }

    return lastResponse || new Response("Google Agent callback route not found", { status: 404 });
}

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get("code");
    const error = req.nextUrl.searchParams.get("error");
    const redirectUri = getRedirectUri(req);

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
        const res = await forwardCodeToAgent(code, redirectUri);
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
                    <p style="color:#888">Is the Google agent running on EC2?</p>
                    <p style="color:#666">${err instanceof Error ? err.message : "Unknown error"}</p>
                </div>
            </body></html>`,
            { status: 502, headers: { "Content-Type": "text/html" } }
        );
    }
}
