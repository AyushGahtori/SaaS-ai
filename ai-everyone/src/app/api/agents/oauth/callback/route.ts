import { NextRequest } from "next/server";
import { getAgentBundle, getAgentCatalogEntry } from "@/lib/agents/catalog";
import {
    installAgentIds,
    saveProviderConnection,
} from "@/lib/agents/user-access.server";

const CALLBACK_PATH = "/api/agents/oauth/callback";

function getRedirectUri(req: NextRequest): string {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
    const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;
    return `${proto}://${host}${CALLBACK_PATH}`;
}

function htmlResult(
    success: boolean,
    message: string,
    bundleId = "",
    agentId = ""
): Response {
    const payload = JSON.stringify({
        type: success ? "Pian_oauth_success" : "Pian_oauth_error",
        bundleId,
        agentId,
        message,
    });

    const color = success ? "#16a34a" : "#ef4444";
    const heading = success ? "Connection complete" : "Connection failed";

    return new Response(
        `<html><body style="background:#0a0a0a;color:#f5f5f5;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
            <div style="max-width:420px;text-align:center;padding:24px;border:1px solid rgba(255,255,255,0.12);border-radius:18px;background:rgba(255,255,255,0.03)">
                <h2 style="margin:0 0 12px;color:${color}">${heading}</h2>
                <p style="margin:0 0 12px;color:#d4d4d8">${message}</p>
                <p style="margin:0;color:#71717a">This window will close automatically.</p>
            </div>
            <script>
                (function () {
                    try {
                        if (window.opener && !window.opener.closed) {
                            window.opener.postMessage(${payload}, window.location.origin);
                        }
                    } catch (_) {}
                    setTimeout(function () { window.close(); }, 1200);
                })();
            </script>
        </body></html>`,
        {
            status: success ? 200 : 400,
            headers: { "Content-Type": "text/html" },
        }
    );
}

export async function GET(req: NextRequest) {
    try {
        const code = req.nextUrl.searchParams.get("code");
        const oauthError = req.nextUrl.searchParams.get("error");
        const stateParam = req.nextUrl.searchParams.get("state");
        const redirectUri = getRedirectUri(req);

        if (oauthError) {
            return htmlResult(false, oauthError);
        }

        if (!code || !stateParam) {
            return htmlResult(false, "Missing OAuth callback parameters.");
        }

        const state = JSON.parse(Buffer.from(stateParam, "base64url").toString()) as {
            uid: string;
            bundleId: string | null;
            agentId: string | null;
            pkceVerifier?: string | null;
        };

        const bundle = state.bundleId ? getAgentBundle(state.bundleId) : undefined;
        const agent = state.agentId ? getAgentCatalogEntry(state.agentId) : undefined;
        if (!bundle && !agent) {
            return htmlResult(false, "Unknown connection target in OAuth callback.");
        }

        const provider = bundle?.provider ?? agent?.provider;
        const scopes = bundle?.scopes ?? agent?.oauthScopes ?? [];
        const installTargets = bundle?.childAgentIds ?? (agent ? [agent.id] : []);

        let tokenData: {
            access_token: string;
            refresh_token?: string;
            expires_in?: number;
            scope?: string;
        };
        let metadata: Record<string, string | null> = {};

        if (provider === "google") {
            const response = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.GOOGLE_CLIENT_ID || "",
                    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "microsoft") {
            const response = await fetch(
                "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        client_id: process.env.MICROSOFT_CLIENT_ID || "",
                        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
                        code,
                        grant_type: "authorization_code",
                        redirect_uri: redirectUri,
                        scope: scopes.join(" "),
                    }),
                }
            );

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "notion") {
            const basicAuth = Buffer.from(
                `${process.env.NOTION_CLIENT_ID || ""}:${process.env.NOTION_CLIENT_SECRET || ""}`
            ).toString("base64");

            const response = await fetch("https://api.notion.com/v1/oauth/token", {
                method: "POST",
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "github") {
            const response = await fetch("https://github.com/login/oauth/access_token", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    client_id: process.env.GITHUB_CLIENT_ID || "",
                    client_secret: process.env.GITHUB_CLIENT_SECRET || "",
                    code,
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "gitlab") {
            const response = await fetch("https://gitlab.com/oauth/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.GITLAB_CLIENT_ID || "",
                    client_secret: process.env.GITLAB_CLIENT_SECRET || "",
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "discord") {
            const response = await fetch("https://discord.com/api/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.DISCORD_CLIENT_ID || "",
                    client_secret: process.env.DISCORD_CLIENT_SECRET || "",
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "dropbox") {
            const response = await fetch("https://api.dropboxapi.com/oauth2/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: process.env.DROPBOX_CLIENT_ID || "",
                    client_secret: process.env.DROPBOX_CLIENT_SECRET || "",
                    code,
                    grant_type: "authorization_code",
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "atlassian") {
            const response = await fetch("https://auth.atlassian.com/oauth/token", {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    grant_type: "authorization_code",
                    client_id: process.env.JIRA_CLIENT_ID || "",
                    client_secret: process.env.JIRA_CLIENT_SECRET || "",
                    code,
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "linkedin") {
            const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: redirectUri,
                    client_id: process.env.LINKEDIN_CLIENT_ID || "",
                    client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;

            const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`,
                },
            });

            if (userInfoResponse.ok) {
                const userInfo = (await userInfoResponse.json()) as { sub?: string };
                if (userInfo.sub) {
                    metadata.urn = `urn:li:person:${userInfo.sub}`;
                }
            }
        } else if (provider === "zoom") {
            const basicAuth = Buffer.from(
                `${process.env.ZOOM_CLIENT_ID || ""}:${process.env.ZOOM_CLIENT_SECRET || ""}`
            ).toString("base64");

            const response = await fetch("https://zoom.us/oauth/token", {
                method: "POST",
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: redirectUri,
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else if (provider === "canva") {
            const basicAuth = Buffer.from(
                `${process.env.CANVA_CLIENT_ID || ""}:${process.env.CANVA_CLIENT_SECRET || ""}`
            ).toString("base64");

            const response = await fetch("https://api.canva.com/rest/v1/oauth/token", {
                method: "POST",
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code,
                    redirect_uri: redirectUri,
                    code_verifier: state.pkceVerifier || "",
                }),
            });

            if (!response.ok) {
                return htmlResult(false, await response.text(), bundle?.id ?? "", agent?.id ?? "");
            }

            tokenData = (await response.json()) as typeof tokenData;
        } else {
            return htmlResult(false, "Unsupported provider.", bundle?.id ?? "", agent?.id ?? "");
        }

        await saveProviderConnection(state.uid, provider as Exclude<typeof provider, "internal">, {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token ?? null,
            expiresAt: tokenData.expires_in
                ? Date.now() + tokenData.expires_in * 1000
                : null,
            scopes,
            metadata,
            bundleId: bundle?.id ?? null,
        });
        await installAgentIds(state.uid, installTargets);

        const label = bundle?.name ?? agent?.name ?? "Connection";
        return htmlResult(true, `${label} connected successfully.`, bundle?.id ?? "", agent?.id ?? "");
    } catch (error) {
        console.error("[Bundle OAuth Callback] error:", error);
        return htmlResult(false, "OAuth callback failed.");
    }
}
