import crypto from "crypto";
import type { NextRequest } from "next/server";

import { getAgentBundle, getAgentCatalogEntry } from "@/lib/agents/catalog";

const DEFAULT_AGENT_SERVER_URL = "http://13.126.69.108";

const OAUTH_AGENT_BASE_URLS: Record<string, string | undefined> = {
    "teams-agent": process.env.TEAMS_AGENT_URL,
    "google-agent": process.env.GOOGLE_AGENT_URL,
    "notion-agent": process.env.NOTION_AGENT_URL,
    "canva-agent": process.env.CANVA_AGENT_URL,
    "discord-agent": process.env.DISCORD_AGENT_URL,
    "dropbox-agent": process.env.DROPBOX_AGENT_URL,
    "github-agent": process.env.GITHUB_AGENT_URL,
    "gitlab-agent": process.env.GITLAB_AGENT_URL,
    "jira-agent": process.env.JIRA_AGENT_URL,
    "linkedin-agent": process.env.LINKEDIN_AGENT_URL,
    "zoom-agent": process.env.ZOOM_AGENT_URL,
};

const AGENT_SLUGS: Record<string, string> = {
    "teams-agent": "teams",
    "google-agent": "google",
    "notion-agent": "notion",
    "canva-agent": "canva",
    "discord-agent": "discord",
    "dropbox-agent": "dropbox",
    "github-agent": "github",
    "gitlab-agent": "gitlab",
    "jira-agent": "jira",
    "linkedin-agent": "linkedin",
    "zoom-agent": "zoom",
};

interface ResolvedOauthTarget {
    provider: string;
    scopes: string[];
    bundleId: string | null;
    agentId: string | null;
    authAgentId: string;
    displayName: string;
    installTargets: string[];
    agentSlug: string;
}

function getOrigin(req: NextRequest): string {
    const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const proto = forwardedProto || req.nextUrl.protocol.replace(":", "") || "http";
    const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;
    return `${proto}://${host}`;
}

function getSharedSecret(): string {
    const secret =
        process.env.AGENT_OAUTH_SHARED_SECRET || process.env.AGENT_OAUTH_SECRET || "";
    if (!secret) {
        throw new Error("AGENT_OAUTH_SHARED_SECRET is not configured.");
    }
    return secret;
}

function signPayload(payload: Record<string, unknown>): string {
    const payloadSegment = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signatureSegment = crypto
        .createHmac("sha256", getSharedSecret())
        .update(payloadSegment)
        .digest("base64url");
    return `${payloadSegment}.${signatureSegment}`;
}

function resolveOauthTarget(target: { bundleId?: string; agentId?: string }): ResolvedOauthTarget {
    const bundle = target.bundleId ? getAgentBundle(target.bundleId) : undefined;
    const agent = target.agentId ? getAgentCatalogEntry(target.agentId) : undefined;

    if (!bundle && !agent) {
        throw new Error("Unknown bundle or agent.");
    }

    const provider = bundle?.provider ?? agent?.provider;
    if (!provider || provider === "internal") {
        throw new Error("This agent does not require OAuth.");
    }

    const authAgentId =
        bundle?.provider === "google"
            ? "google-agent"
            : bundle?.provider === "microsoft"
              ? "teams-agent"
              : agent?.id || "";

    const agentSlug = AGENT_SLUGS[authAgentId];
    if (!agentSlug) {
        throw new Error(`No detached EC2 OAuth slug is configured for ${authAgentId}.`);
    }

    return {
        provider,
        scopes: bundle?.scopes ?? agent?.oauthScopes ?? [],
        bundleId: bundle?.id ?? null,
        agentId: agent?.id ?? null,
        authAgentId,
        displayName: bundle?.name ?? agent?.name ?? "Connection",
        installTargets: bundle?.childAgentIds ?? (agent ? [agent.id] : []),
        agentSlug,
    };
}

export function buildEc2OauthLaunch(
    req: NextRequest,
    uid: string,
    target: { bundleId?: string; agentId?: string }
): { authUrl: string; popupOrigin: string } {
    const resolved = resolveOauthTarget(target);
    const baseUrl =
        OAUTH_AGENT_BASE_URLS[resolved.authAgentId] ||
        process.env.AGENT_SERVER_URL ||
        DEFAULT_AGENT_SERVER_URL;

    const handoff = signPayload({
        uid,
        provider: resolved.provider,
        bundleId: resolved.bundleId,
        agentId: resolved.agentId,
        installTargets: resolved.installTargets,
        scopes: resolved.scopes,
        displayName: resolved.displayName,
        returnOrigin: getOrigin(req),
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 300,
    });

    const authUrl = `${baseUrl.replace(/\/$/, "")}/${resolved.agentSlug}/auth/login?handoff=${encodeURIComponent(handoff)}`;
    return {
        authUrl,
        popupOrigin: new URL(authUrl).origin,
    };
}
