"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { Bell, Bot, BrainCircuit, Link2, Settings2, User } from "lucide-react";
import { auth } from "@/lib/firebase";
import { getUserProfile, updateUserProfile } from "@/lib/firestore";
import { getAllAgents, type Agent } from "@/lib/firestore-agents";
import { MemoryManager } from "@/modules/profile/ui/memory-manager";
import { ReminderManager } from "@/modules/settings/ui/components/reminder-manager";

type SettingsTab = "profile" | "agents" | "memory" | "reminders";

interface AgentStateResponse {
  installedAgentIds: string[];
  connectedBundleIds: string[];
}

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

export function SettingsView() {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const [uid, setUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketplaceItems, setMarketplaceItems] = useState<Agent[]>([]);
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [connectedBundleIds, setConnectedBundleIds] = useState<string[]>([]);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    role: "",
    communicationStyle: "",
  });

  const loadAgentState = useCallback(async () => {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/agents", {
      method: "GET",
      headers,
    });
    const data = (await response.json().catch(() => ({}))) as AgentStateResponse & { error?: string };

    if (!response.ok) {
      throw new Error(data.error || "Failed to load installed agents.");
    }

    setInstalledIds(data.installedAgentIds ?? []);
    setConnectedBundleIds(data.connectedBundleIds ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    if (!uid) return;

    setLoading(true);
    setError(null);

    try {
      const [profile, items] = await Promise.all([
        getUserProfile(uid),
        getAllAgents(),
      ]);

      setMarketplaceItems(items);
      setProfileForm({
        name: profile?.name?.toString() || auth.currentUser?.displayName || "User",
        email: profile?.email?.toString() || auth.currentUser?.email || "",
        role: profile?.role?.toString() || "",
        communicationStyle: profile?.communicationStyle?.toString() || "",
      });

      await loadAgentState();
    } catch (err) {
      console.error("[SettingsView] load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [loadAgentState, uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (uid) {
      loadSettings();
    }
  }, [loadSettings, uid]);

  const handleProfileSave = async () => {
    if (!uid) return;

    setSaving(true);
    setError(null);
    try {
      await updateUserProfile(uid, {
        name: profileForm.name,
        email: profileForm.email,
        role: profileForm.role,
        communicationStyle: profileForm.communicationStyle,
      });

      if (auth.currentUser && profileForm.name.trim()) {
        await updateProfile(auth.currentUser, {
          displayName: profileForm.name.trim(),
        });
      }

      window.dispatchEvent(
        new CustomEvent("snitchx-profile-updated", {
          detail: {
            name: profileForm.name,
            email: profileForm.email,
          },
        })
      );
    } catch (err) {
      console.error("[SettingsView] save profile error:", err);
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleUninstall = async (item: Agent) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/agents", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "uninstall",
          targetId: item.id,
          targetType: item.kind,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to uninstall agent.");
      }

      await loadAgentState();
    } catch (err) {
      console.error("[SettingsView] uninstall error:", err);
      setError(err instanceof Error ? err.message : "Failed to uninstall agent.");
    }
  };

  const installedItems = useMemo(
    () => marketplaceItems.filter((item) => installedIds.includes(item.id)),
    [installedIds, marketplaceItems]
  );

  const connectedBundles = useMemo(
    () => marketplaceItems.filter((item) => connectedBundleIds.includes(item.id)),
    [connectedBundleIds, marketplaceItems]
  );

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: User },
    { id: "agents" as const, label: "Installed Agents", icon: Bot },
    { id: "memory" as const, label: "Memory", icon: BrainCircuit },
    { id: "reminders" as const, label: "Reminders", icon: Bell },
  ];

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-sm text-white/50">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="custom-scrollbar h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden w-full">
      <div className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <div className="flex items-center gap-3">
          <Settings2 className="h-8 w-8 text-cyan-400" />
          <div>
            <h1 className="text-2xl font-bold text-white/95">Settings</h1>
            <p className="text-sm text-white/40">
              Manage your installed agents, memory controls, and personal profile without leaving SnitchX.
            </p>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
          {tabs.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === item.id
                  ? "bg-white text-black"
                  : "border border-white/10 bg-white/[0.03] text-white/65 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {tab === "profile" ? (
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Profile</h2>
              <p className="mt-1 text-xs text-white/40">These values help personalize the persona and chat experience without replacing your onboarding flow.</p>

              <div className="mt-5 space-y-4">
                <label className="block text-sm text-white/75">
                  Display name
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  />
                </label>

                <label className="block text-sm text-white/75">
                  Email
                  <input
                    value={profileForm.email}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  />
                </label>

                <label className="block text-sm text-white/75">
                  Role
                  <input
                    value={profileForm.role}
                    onChange={(event) => setProfileForm((prev) => ({ ...prev, role: event.target.value }))}
                    placeholder="Founder, developer, operator..."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  />
                </label>

                <label className="block text-sm text-white/75">
                  Communication style
                  <input
                    value={profileForm.communicationStyle}
                    onChange={(event) =>
                      setProfileForm((prev) => ({ ...prev, communicationStyle: event.target.value }))
                    }
                    placeholder="Concise, detailed, direct..."
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                  />
                </label>
              </div>

              <button
                onClick={handleProfileSave}
                disabled={saving}
                className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Workspace Summary</h2>
              <div className="mt-4 space-y-3 text-sm text-white/70">
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">Connected Bundles</p>
                  <p className="mt-2 text-xl font-semibold text-white">{connectedBundles.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/35">Installed Agents</p>
                  <p className="mt-2 text-xl font-semibold text-white">{installedItems.length}</p>
                </div>
                <Link
                  href="/agents"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-white/75 transition hover:border-white/20 hover:text-white"
                >
                  <Link2 className="h-4 w-4" />
                  Open marketplace to connect or install more agents
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "agents" ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Connected Bundles</h2>
              <p className="mt-1 text-xs text-white/40">Disconnecting a bundle revokes provider access and uninstalls its child agents from your account.</p>

              <div className="mt-4 space-y-3">
                {connectedBundles.length ? connectedBundles.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.iconUrl} alt={item.name} className="h-10 w-10 rounded-xl object-contain" />
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-white/45">{item.description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUninstall(item)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:text-white"
                    >
                      Disconnect
                    </button>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                    No bundles connected yet.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h2 className="text-lg font-semibold text-white">Installed Agents</h2>
              <p className="mt-1 text-xs text-white/40">Only installed agents can be used by chat orchestration.</p>

              <div className="mt-4 space-y-3">
                {installedItems.length ? installedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.iconUrl} alt={item.name} className="h-10 w-10 rounded-xl object-contain" />
                      <div>
                        <p className="font-medium text-white">{item.name}</p>
                        <p className="text-xs text-white/45">{item.category}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleUninstall(item)}
                      className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65 transition hover:text-white"
                    >
                      Uninstall
                    </button>
                  </div>
                )) : (
                  <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-sm text-white/45">
                    No agents installed yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {tab === "memory" ? <MemoryManager /> : null}
        {tab === "reminders" ? <ReminderManager /> : null}
      </div>
    </div>
  );
}
