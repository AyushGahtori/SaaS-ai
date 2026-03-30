"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { MemoryItem, MemorySettings, MemoryType, PersonaSummary } from "@/lib/memory/types";

const TYPE_COLORS: Record<string, string> = {
    role: "bg-blue-900/40 text-blue-300 border-blue-700",
    goal: "bg-purple-900/40 text-purple-300 border-purple-700",
    preference: "bg-teal-900/40 text-teal-300 border-teal-700",
    context: "bg-amber-900/40 text-amber-300 border-amber-700",
    skill: "bg-green-900/40 text-green-300 border-green-700",
    project: "bg-orange-900/40 text-orange-300 border-orange-700",
    education: "bg-indigo-900/40 text-indigo-300 border-indigo-700",
    identity: "bg-rose-900/40 text-rose-300 border-rose-700",
};

const MEMORY_TYPES: MemoryType[] = [
    "identity",
    "role",
    "goal",
    "preference",
    "context",
    "skill",
    "project",
    "education",
];

const EMPTY_FORM = {
    type: "preference" as MemoryType,
    key: "",
    value: "",
    scope: "stable" as "stable" | "temporary",
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

export function MemoryManager() {
    const [ready, setReady] = useState(false);
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [persona, setPersona] = useState<PersonaSummary | null>(null);
    const [settings, setSettings] = useState<MemorySettings>({
        maxTotalMemories: 20,
        tempMemoryTTLDays: 30,
        requireConfirmation: false,
    });
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, () => {
            setReady(true);
        });
        return () => unsub();
    }, []);

    const fetchMemoryState = useCallback(async () => {
        if (!auth.currentUser) return;

        setLoading(true);
        setError(null);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("/api/memory", {
                method: "GET",
                headers,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to load memories.");
            }

            setMemories(data.memories ?? []);
            setPersona(data.persona ?? null);
            if (data.settings) {
                setSettings(data.settings);
            }
        } catch (err) {
            console.error("[MemoryManager] fetch error:", err);
            setError(err instanceof Error ? err.message : "Failed to load memory state.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (ready && auth.currentUser) {
            fetchMemoryState();
        }
    }, [fetchMemoryState, ready]);

    const handleDelete = async (memoryId: string) => {
        try {
            const headers = await getAuthHeaders();
            const response = await fetch(`/api/memory?memoryId=${memoryId}`, {
                method: "DELETE",
                headers,
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to delete memory.");
            }

            setMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
        } catch (err) {
            console.error("[MemoryManager] delete error:", err);
            setError(err instanceof Error ? err.message : "Failed to delete memory.");
        }
    };

    const startEdit = (memory: MemoryItem) => {
        setEditingId(memory.id!);
        setEditValue(memory.value ?? "");
    };

    const saveEdit = async (memoryId: string) => {
        setSavingId(memoryId);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("/api/memory", {
                method: "PATCH",
                headers,
                body: JSON.stringify({ memoryId, value: editValue }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to update memory.");
            }

            setMemories((prev) =>
                prev.map((memory) =>
                    memory.id === memoryId ? { ...memory, value: editValue, updatedAt: new Date().toISOString() } : memory
                )
            );
            setEditingId(null);
        } catch (err) {
            console.error("[MemoryManager] save error:", err);
            setError(err instanceof Error ? err.message : "Failed to update memory.");
        } finally {
            setSavingId(null);
        }
    };

    const handleCreate = async () => {
        if (!form.key.trim() || !form.value.trim()) {
            setError("Key and value are required to add a memory.");
            return;
        }

        setCreating(true);
        setError(null);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("/api/memory", {
                method: "POST",
                headers,
                body: JSON.stringify(form),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to add memory.");
            }

            setForm(EMPTY_FORM);
            await fetchMemoryState();
        } catch (err) {
            console.error("[MemoryManager] create error:", err);
            setError(err instanceof Error ? err.message : "Failed to add memory.");
        } finally {
            setCreating(false);
        }
    };

    const saveSettings = async () => {
        setSettingsSaving(true);
        setError(null);
        try {
            const headers = await getAuthHeaders();
            const response = await fetch("/api/memory", {
                method: "PATCH",
                headers,
                body: JSON.stringify({
                    target: "settings",
                    maxTotalMemories: settings.maxTotalMemories,
                    tempMemoryTTLDays: settings.tempMemoryTTLDays,
                    requireConfirmation: settings.requireConfirmation,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.error || "Failed to save memory settings.");
            }
        } catch (err) {
            console.error("[MemoryManager] settings error:", err);
            setError(err instanceof Error ? err.message : "Failed to save memory settings.");
        } finally {
            setSettingsSaving(false);
        }
    };

    const capacityText = useMemo(
        () => `${memories.length} / ${settings.maxTotalMemories} memories stored`,
        [memories.length, settings.maxTotalMemories]
    );

    if (!ready || loading) {
        return (
            <div className="flex h-32 items-center justify-center text-sm text-neutral-500">
                Loading memories...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error ? (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-white">Persona Summary</h2>
                            <p className="text-xs text-white/40">This is the memory-backed summary injected into personal context replies.</p>
                        </div>
                        <button
                            onClick={fetchMemoryState}
                            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition-colors hover:text-white"
                        >
                            Refresh
                        </button>
                    </div>
                    <p className="text-sm leading-6 text-white/75">
                        {persona?.summary || "No persona summary has been compiled yet."}
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                    <h2 className="text-lg font-semibold text-white">Memory Settings</h2>
                    <p className="mt-1 text-xs text-white/40">{capacityText}</p>

                    <div className="mt-4 space-y-4">
                        <label className="block text-sm text-white/75">
                            Max memories
                            <input
                                type="number"
                                min={5}
                                max={100}
                                value={settings.maxTotalMemories}
                                onChange={(event) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        maxTotalMemories: Number(event.target.value || 20),
                                    }))
                                }
                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                            />
                        </label>

                        <label className="block text-sm text-white/75">
                            Temporary memory TTL (days)
                            <input
                                type="number"
                                min={1}
                                max={90}
                                value={settings.tempMemoryTTLDays}
                                onChange={(event) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        tempMemoryTTLDays: Number(event.target.value || 30),
                                    }))
                                }
                                className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-white outline-none"
                            />
                        </label>

                        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white/75">
                            Require confirmation before saving new memories
                            <input
                                type="checkbox"
                                checked={settings.requireConfirmation}
                                onChange={(event) =>
                                    setSettings((prev) => ({
                                        ...prev,
                                        requireConfirmation: event.target.checked,
                                    }))
                                }
                                className="h-4 w-4 accent-white"
                            />
                        </label>

                        <button
                            onClick={saveSettings}
                            disabled={settingsSaving}
                            className="w-full rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {settingsSaving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-white">Add Memory</h2>
                    <p className="text-xs text-white/40">Store a fact manually so only installed memory tooling can use it later.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                        value={form.type}
                        onChange={(event) =>
                            setForm((prev) => ({ ...prev, type: event.target.value as MemoryType }))
                        }
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    >
                        {MEMORY_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>

                    <input
                        value={form.key}
                        onChange={(event) => setForm((prev) => ({ ...prev, key: event.target.value }))}
                        placeholder="Key, e.g. work_style"
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    />

                    <select
                        value={form.scope}
                        onChange={(event) =>
                            setForm((prev) => ({
                                ...prev,
                                scope: event.target.value as "stable" | "temporary",
                            }))
                        }
                        className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
                    >
                        <option value="stable">Stable</option>
                        <option value="temporary">Temporary</option>
                    </select>

                    <button
                        onClick={handleCreate}
                        disabled={creating}
                        className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {creating ? "Adding..." : "Add Memory"}
                    </button>
                </div>

                <textarea
                    value={form.value}
                    onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                    placeholder="Value"
                    rows={3}
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm text-white outline-none"
                />
            </div>

            {memories.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] text-center">
                    <div className="text-4xl">🧠</div>
                    <p className="text-sm text-neutral-400">No memories stored yet.</p>
                    <p className="text-xs text-neutral-600">As you chat, SnitchX will extract preferences and context here.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {memories.map((memory) => {
                        const isEditing = editingId === memory.id;
                        const isSaving = savingId === memory.id;
                        const typeColor =
                            TYPE_COLORS[memory.type] ?? "bg-neutral-800 text-neutral-400 border-neutral-700";
                        const isTemp = memory.scope === "temporary";

                        return (
                            <div
                                key={memory.id}
                                className="group rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-all hover:border-neutral-700"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-2 flex flex-wrap items-center gap-2">
                                            <span className={`rounded-md border px-2 py-0.5 font-mono text-xs ${typeColor}`}>
                                                {memory.type}
                                            </span>
                                            <span className="font-mono text-xs text-neutral-500">{memory.key}</span>
                                            {isTemp ? (
                                                <span className="rounded border border-amber-700/50 px-1.5 py-0.5 text-xs text-amber-500">
                                                    temporary
                                                </span>
                                            ) : null}
                                            <span className="text-xs text-neutral-600">{memory.source}</span>
                                        </div>

                                        {isEditing ? (
                                            <div className="mt-1 flex gap-2">
                                                <input
                                                    value={editValue}
                                                    onChange={(event) => setEditValue(event.target.value)}
                                                    className="flex-1 rounded-lg border border-neutral-600 bg-neutral-800 px-3 py-1.5 text-sm text-white outline-none focus:border-neutral-400"
                                                    autoFocus
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") saveEdit(memory.id!);
                                                        if (event.key === "Escape") setEditingId(null);
                                                    }}
                                                />
                                                <button
                                                    onClick={() => saveEdit(memory.id!)}
                                                    disabled={isSaving}
                                                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-neutral-200"
                                                >
                                                    {isSaving ? "..." : "Save"}
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className="px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:text-white"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="break-words text-sm font-medium text-white">
                                                {memory.value ?? <span className="italic text-neutral-600">empty</span>}
                                            </p>
                                        )}

                                        <p className="mt-2 text-xs text-neutral-600">
                                            Updated {new Date(memory.updatedAt).toLocaleString()}
                                            {isTemp && memory.expiresAt ? ` • Expires ${new Date(memory.expiresAt).toLocaleDateString()}` : ""}
                                        </p>
                                    </div>

                                    {!isEditing ? (
                                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            <button
                                                onClick={() => startEdit(memory)}
                                                className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-white"
                                                title="Edit"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(memory.id!)}
                                                className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-red-400"
                                                title="Delete"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="3 6 5 6 21 6"/>
                                                    <path d="M19 6l-1 14H6L5 6"/>
                                                    <path d="M10 11v6M14 11v6"/>
                                                    <path d="M9 6V4h6v2"/>
                                                </svg>
                                            </button>
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
