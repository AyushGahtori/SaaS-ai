import { NextRequest, NextResponse } from "next/server";
import { getAgentBundle, getAgentCatalogEntry } from "@/lib/agents/catalog";
import { verifyFirebaseRequest } from "@/lib/server-auth";

const CALLBACK_PATH = "/api/agents/oauth/callback";

function getRedirectUri(req: NextRequest): string {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
    const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;
    return `${proto}://${host}${CALLBACK_PATH}`;
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const bundleId = String(body.bundleId || "");
        const agentId = String(body.agentId || "");
        const bundle = bundleId ? getAgentBundle(bundleId) : undefined;
        const agent = agentId ? getAgentCatalogEntry(agentId) : undefined;

        if (!bundle && !agent) {
            return NextResponse.json({ error: "Unknown bundle or agent." }, { status: 404 });
        }

        const provider = bundle?.provider ?? agent?.provider;
        const scopes = bundle?.scopes ?? agent?.oauthScopes ?? [];

        const redirectUri = getRedirectUri(req);
        const state = Buffer.from(
            JSON.stringify({
                uid: verifiedUser.uid,
                bundleId: bundle?.id ?? null,
                agentId: agent?.id ?? null,
            })
        ).toString("base64url");

        let authUrl = "";

        if (provider === "google") {
            const clientId = process.env.GOOGLE_CLIENT_ID || "";
            if (!clientId) {
                return NextResponse.json({ error: "GOOGLE_CLIENT_ID is not configured." }, { status: 500 });
            }

            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: scopes.join(" "),
                state,
                access_type: "offline",
                prompt: "consent",
            });
            authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        } else if (provider === "microsoft") {
            const clientId = process.env.MICROSOFT_CLIENT_ID || "";
            if (!clientId) {
                return NextResponse.json({ error: "MICROSOFT_CLIENT_ID is not configured." }, { status: 500 });
            }

            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: "code",
                scope: scopes.join(" "),
                state,
                prompt: "consent",
            });
            authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
        } else if (provider === "notion") {
            const clientId = process.env.NOTION_CLIENT_ID || "";
            if (!clientId) {
                return NextResponse.json({ error: "NOTION_CLIENT_ID is not configured." }, { status: 500 });
            }

            const params = new URLSearchParams({
                client_id: clientId,
                redirect_uri: redirectUri,
                response_type: "code",
                owner: "user",
                state,
            });
            authUrl = `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
        } else {
            return NextResponse.json({ error: "Unsupported provider." }, { status: 400 });
        }

        return NextResponse.json({ authUrl });
    } catch (error) {
        console.error("[Bundle OAuth Start] error:", error);
        return NextResponse.json({ error: "Failed to start OAuth." }, { status: 500 });
    }
}
