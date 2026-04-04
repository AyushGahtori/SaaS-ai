"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getAllAgents,
  getFeaturedAgents,
  getTrendingAgents,
  type Agent,
} from "@/lib/firestore-agents";
import { AgentsSearchBar } from "../components/agents-search-bar";
import { AgentsFeaturedSection } from "../components/agents-featured-section";
import { AgentsTrendingSection } from "../components/agents-trending-section";
import { AgentsGrid } from "../components/agents-grid";
import { Bot, Loader2 } from "lucide-react";

interface AgentStateResponse {
  installedAgentIds: string[];
  accessibleAgentIds: string[];
  connectedBundleIds: string[];
  connections: Record<string, boolean>;
}

type AgentFilterChip =
  | "all"
  | "productivity"
  | "google"
  | "microsoft"
  | "notion"
  | "location"
  | "calendar"
  | "reminders";

const FILTER_CHIPS: AgentFilterChip[] = [
  "all",
  "productivity",
  "google",
  "microsoft",
  "notion",
  "location",
  "calendar",
  "reminders",
];

const MAX_SECONDARY_SECTIONS = 4;

const CHIP_LABELS: Record<AgentFilterChip, string> = {
  all: "All",
  productivity: "Productivity",
  google: "Google",
  microsoft: "Microsoft",
  notion: "Notion",
  location: "Location",
  calendar: "Calendar",
  reminders: "Reminders",
};

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Authentication expired. Please sign in again.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export const AgentsView = () => {
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const [trendingAgents, setTrendingAgents] = useState<Agent[]>([]);
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [accessibleIds, setAccessibleIds] = useState<string[]>([]);
  const [connectedBundleIds, setConnectedBundleIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeChip, setActiveChip] = useState<AgentFilterChip>("all");
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMarketplaceState = useCallback(async () => {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/agents", {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to load installed agents.");
    }

    const data = (await response.json()) as AgentStateResponse;
    setInstalledIds(data.installedAgentIds ?? []);
    setAccessibleIds(data.accessibleAgentIds ?? []);
    setConnectedBundleIds(data.connectedBundleIds ?? []);
  }, []);

  const loadMarketplace = useCallback(async () => {
    if (!uid) return;

    setLoading(true);
    setError(null);

    try {
      const [all, featured, trending] = await Promise.all([
        getAllAgents(),
        getFeaturedAgents(),
        getTrendingAgents(10),
      ]);

      setAllAgents(all);
      setFeaturedAgents(featured);
      setTrendingAgents(trending);
      await loadMarketplaceState();
    } catch (err) {
      console.error("[AgentsView] load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load marketplace.");
    } finally {
      setLoading(false);
    }
  }, [loadMarketplaceState, uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (uid) {
      loadMarketplace();
    }
  }, [uid, loadMarketplace]);

  const searchedAgents = useMemo(() => {
    if (!searchQuery.trim()) return allAgents;
    const query = searchQuery.toLowerCase();

    return allAgents.filter(
      (agent) =>
        agent.name.toLowerCase().includes(query) ||
        agent.category.toLowerCase().includes(query) ||
        agent.description.toLowerCase().includes(query) ||
        (agent.tags || []).some((tag) => tag.toLowerCase().includes(query))
    );
  }, [allAgents, searchQuery]);

  const doesAgentMatchChip = useCallback((agent: Agent, chip: AgentFilterChip) => {
    if (chip === "all") return true;
    const normalizedChip = chip.toLowerCase();

    if (agent.category.toLowerCase() === normalizedChip) return true;
    if (agent.provider.toLowerCase() === normalizedChip) return true;

    return (agent.tags || []).some((tag) => tag.toLowerCase() === normalizedChip);
  }, []);

  const chipMatchedAgents = useMemo(() => {
    if (activeChip === "all") return searchedAgents;
    return searchedAgents.filter((agent) => doesAgentMatchChip(agent, activeChip));
  }, [activeChip, doesAgentMatchChip, searchedAgents]);

  const groupedBrowseSections = useMemo(() => {
    if (activeChip === "all") return [];

    const sections: Array<{ title: string; agents: Agent[] }> = [];

    if (chipMatchedAgents.length > 0) {
      sections.push({
        title: `${CHIP_LABELS[activeChip]} Agents`,
        agents: chipMatchedAgents,
      });
    }

    const selectedAgentIds = new Set(chipMatchedAgents.map((agent) => agent.id));
    const buckets = new Map<string, Agent[]>();

    for (const agent of searchedAgents) {
      if (selectedAgentIds.has(agent.id)) continue;
      const key = agent.category.toLowerCase();
      const existing = buckets.get(key);
      if (existing) {
        existing.push(agent);
      } else {
        buckets.set(key, [agent]);
      }
    }

    const normalizeHeading = (value: string) =>
      value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");

    const secondary = Array.from(buckets.entries())
      .sort((left, right) => right[1].length - left[1].length)
      .slice(0, MAX_SECONDARY_SECTIONS)
      .map(([category, agents]) => ({
        title: `${normalizeHeading(category)} Agents`,
        agents,
      }));

    return [...sections, ...secondary];
  }, [activeChip, chipMatchedAgents, searchedAgents]);

  const openConnectionPopup = useCallback(async (target: { bundleId?: string; agentId?: string }) => {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/agents/oauth/start", {
      method: "POST",
      headers,
      body: JSON.stringify(target),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.authUrl) {
      throw new Error(data.error || "Failed to start authorization.");
    }

    const allowedPopupOrigin =
      typeof data.popupOrigin === "string" && data.popupOrigin.length > 0
        ? data.popupOrigin
        : new URL(data.authUrl).origin;

    const popupTarget = target.bundleId || target.agentId || "agent";
    const popup = window.open(
      data.authUrl,
      `oauth-${popupTarget}`,
      "width=560,height=720,menubar=no,toolbar=no,location=yes,status=no"
    );

    if (!popup) {
      throw new Error("Popup blocked. Please allow popups and try again.");
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("Authorization timed out. Please try again."));
      }, 180000);

      const interval = window.setInterval(() => {
        if (popup.closed && !settled) {
          cleanup();
          reject(new Error("Authorization window was closed before completion."));
        }
      }, 500);

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== allowedPopupOrigin) return;
        if (!event.data || typeof event.data !== "object") return;

        const sameTarget =
          (target.bundleId && event.data.bundleId === target.bundleId) ||
          (target.agentId && event.data.agentId === target.agentId);

        if (event.data.type === "Pian_oauth_success" && sameTarget) {
          settled = true;
          cleanup();
          resolve();
        }

        if (event.data.type === "Pian_oauth_error" && sameTarget) {
          settled = true;
          cleanup();
          reject(new Error(event.data.message || "Bundle connection failed."));
        }
      };

      const cleanup = () => {
        window.clearTimeout(timeout);
        window.clearInterval(interval);
        window.removeEventListener("message", handleMessage);
      };

      window.addEventListener("message", handleMessage);
    });
  }, []);

  const runAgentMutation = useCallback(
    async (payload: { action: "install" | "uninstall"; targetId: string; targetType: "agent" | "bundle" }) => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/agents", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.oauthRequired && (data.bundleId || data.agentId)) {
          await openConnectionPopup({
            bundleId: data.bundleId || undefined,
            agentId: data.agentId || undefined,
          });
          await loadMarketplaceState();
          return;
        }
        throw new Error(data.error || "Failed to update agent state.");
      }

      await loadMarketplaceState();
    },
    [loadMarketplaceState, openConnectionPopup]
  );

  const handleInstall = useCallback(
    async (agentId: string) => {
      const item = allAgents.find((agent) => agent.id === agentId);
      if (!item) return;

      setError(null);

      if (item.kind === "bundle") {
        if (!connectedBundleIds.includes(item.id)) {
          await openConnectionPopup({ bundleId: item.id });
          await loadMarketplaceState();
          return;
        }

        await runAgentMutation({
          action: "install",
          targetId: item.id,
          targetType: "bundle",
        });
        return;
      }

      if (item.requiresConnection && item.bundleId && !connectedBundleIds.includes(item.bundleId)) {
        await openConnectionPopup({ bundleId: item.bundleId });
        await loadMarketplaceState();
        return;
      }

      await runAgentMutation({
        action: "install",
        targetId: item.id,
        targetType: "agent",
      });
    },
    [allAgents, connectedBundleIds, loadMarketplaceState, openConnectionPopup, runAgentMutation]
  );

  const handleUninstall = useCallback(
    async (agentId: string) => {
      const item = allAgents.find((agent) => agent.id === agentId);
      if (!item) return;

      setError(null);

      await runAgentMutation({
        action: "uninstall",
        targetId: item.id,
        targetType: item.kind,
      });
    },
    [allAgents, runAgentMutation]
  );

  const ownedIds = useMemo(
    () => Array.from(new Set([...installedIds, ...connectedBundleIds])),
    [connectedBundleIds, installedIds]
  );

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  const isSearching = searchQuery.trim().length > 0;
  const showCuratedLayout = !isSearching && activeChip === "all";

  return (
    <div className="custom-scrollbar h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden w-full">
      <div className="max-w-7xl space-y-10 px-6 py-8">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white/95">Agent Marketplace</h1>
            <p className="text-sm text-white/40">
              Install real agents, connect Google and Microsoft bundles, and control what your account can use.
            </p>
          </div>
        </div>

        <AgentsSearchBar value={searchQuery} onChange={setSearchQuery} />

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {FILTER_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveChip(chip)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${activeChip === chip
                  ? "border-white/30 bg-white/[0.16] text-white"
                  : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/20 hover:text-white"
                }`}
            >
              {CHIP_LABELS[chip]}
            </button>
          ))}
        </div>

        {showCuratedLayout ? (
          <>
            <AgentsFeaturedSection
              agents={featuredAgents}
              installedAgentIds={ownedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />

            <AgentsTrendingSection
              title="Trending This Week"
              agents={trendingAgents.slice(0, 5)}
              installedAgentIds={ownedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />

            <AgentsTrendingSection
              title="Trending This Month"
              agents={trendingAgents}
              installedAgentIds={ownedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />

            <AgentsGrid
              agents={allAgents}
              installedAgentIds={ownedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />
          </>
        ) : activeChip === "all" ? (
          <AgentsGrid
            agents={searchedAgents}
            installedAgentIds={ownedIds}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
          />
        ) : groupedBrowseSections.length > 0 ? (
          <div className="space-y-8">
            {groupedBrowseSections.map((section) => (
              <AgentsGrid
                key={section.title}
                title={section.title}
                agents={section.agents}
                installedAgentIds={ownedIds}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
              />
            ))}
          </div>
        ) : (
          <AgentsGrid
            title={`${CHIP_LABELS[activeChip]} Agents`}
            agents={chipMatchedAgents}
            installedAgentIds={ownedIds}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
          />
        )}
      </div>
    </div>
  );
};
