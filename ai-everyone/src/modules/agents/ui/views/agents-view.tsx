"use client";
// Main marketplace view — composes search bar, featured section,
// trending sections, and the all-agents grid.

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  getAllAgents,
  getFeaturedAgents,
  getTrendingAgents,
  type Agent,
} from "@/lib/firestore-agents";
import {
  getUserInstalledAgents,
  installAgentForUser,
  uninstallAgentForUser,
} from "@/lib/firestore";
import {
  incrementInstallCount,
  decrementInstallCount,
} from "@/lib/firestore-agents";
import { AgentsSearchBar } from "../components/agents-search-bar";
import { AgentsFeaturedSection } from "../components/agents-featured-section";
import { AgentsTrendingSection } from "../components/agents-trending-section";
import { AgentsGrid } from "../components/agents-grid";
import { Loader2, Bot } from "lucide-react";

export const AgentsView = () => {
  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [featuredAgents, setFeaturedAgents] = useState<Agent[]>([]);
  const [trendingAgents, setTrendingAgents] = useState<Agent[]>([]);
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Auth listener — get current user UID
  // -------------------------------------------------------------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  // -------------------------------------------------------------------------
  // Data fetching — runs once uid is known
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!uid) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [all, featured, trending, installed] = await Promise.all([
          getAllAgents(),
          getFeaturedAgents(),
          getTrendingAgents(10),
          getUserInstalledAgents(uid),
        ]);
        setAllAgents(all);
        setFeaturedAgents(featured);
        setTrendingAgents(trending);
        setInstalledIds(installed);
      } catch (err) {
        console.error("Failed to load agents:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [uid]);

  // -------------------------------------------------------------------------
  // Search filtering — client-side since Firestore doesn't support full-text
  // -------------------------------------------------------------------------
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return allAgents;
    const q = searchQuery.toLowerCase();
    return allAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
  }, [allAgents, searchQuery]);

  // -------------------------------------------------------------------------
  // Install / Uninstall handlers
  // -------------------------------------------------------------------------
  const handleInstall = async (agentId: string) => {
    if (!uid) return;
    await installAgentForUser(uid, agentId);
    await incrementInstallCount(agentId);
    setInstalledIds((prev) => [...prev, agentId]);
    // update installCount in local state
    setAllAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, installCount: a.installCount + 1 } : a
      )
    );
    setTrendingAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, installCount: a.installCount + 1 } : a
      )
    );
    setFeaturedAgents((prev) =>
      prev.map((a) =>
        a.id === agentId ? { ...a, installCount: a.installCount + 1 } : a
      )
    );
  };

  const handleUninstall = async (agentId: string) => {
    if (!uid) return;
    await uninstallAgentForUser(uid, agentId);
    await decrementInstallCount(agentId);
    setInstalledIds((prev) => prev.filter((id) => id !== agentId));
    setAllAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? { ...a, installCount: Math.max(0, a.installCount - 1) }
          : a
      )
    );
    setTrendingAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? { ...a, installCount: Math.max(0, a.installCount - 1) }
          : a
      )
    );
    setFeaturedAgents((prev) =>
      prev.map((a) =>
        a.id === agentId
          ? { ...a, installCount: Math.max(0, a.installCount - 1) }
          : a
      )
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  const isSearching = searchQuery.trim().length > 0;

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto">
      <div className="mx-auto max-w-7xl space-y-10 px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-indigo-400" />
          <div>
            <h1 className="text-2xl font-bold text-white/95">Agent Marketplace</h1>
            <p className="text-sm text-white/40">
              Discover and install AI agents to supercharge your workflow
            </p>
          </div>
        </div>

        {/* Search bar */}
        <AgentsSearchBar value={searchQuery} onChange={setSearchQuery} />

        {/* If searching, show only filtered grid */}
        {isSearching ? (
          <AgentsGrid
            agents={filteredAgents}
            installedAgentIds={installedIds}
            onInstall={handleInstall}
            onUninstall={handleUninstall}
          />
        ) : (
          <>
            {/* Featured section */}
            <AgentsFeaturedSection
              agents={featuredAgents}
              installedAgentIds={installedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />

            {/* Trending this week */}
            <AgentsTrendingSection
              title="Trending This Week"
              agents={trendingAgents.slice(0, 5)}
              installedAgentIds={installedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />

            {/* Trending this month */}
            <AgentsTrendingSection
              title="Trending This Month"
              agents={trendingAgents}
              installedAgentIds={installedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />

            {/* All agents grid */}
            <AgentsGrid
              agents={allAgents}
              installedAgentIds={installedIds}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
            />
          </>
        )}
      </div>
    </div>
  );
};
