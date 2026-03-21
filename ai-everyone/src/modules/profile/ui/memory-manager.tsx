"use client";

/**
 * MemoryManager — View, edit, and delete personal memories.
 *
 * Accessible from the dashboard sidebar or settings page.
 * Fetches memories via GET /api/memory and allows:
 * - Soft-deleting individual memories
 * - Inline-editing memory values
 * - Viewing metadata (type, scope, source, confidence, expiry)
 */

import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { MemoryItem } from "@/lib/memory/types";

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

export function MemoryManager() {
    const [uid, setUid] = useState<string | null>(null);
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);

    // Get current user uid
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user) => {
            setUid(user?.uid ?? null);
        });
        return () => unsub();
    }, []);

    // Fetch memories when uid is available
    const fetchMemories = useCallback(async () => {
        if (!uid) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/memory?userId=${uid}`);
            const data = await res.json();
            setMemories(data.memories ?? []);
        } catch (err) {
            console.error("[MemoryManager] fetch error:", err);
        } finally {
            setLoading(false);
        }
    }, [uid]);

    useEffect(() => {
        if (uid) fetchMemories();
    }, [uid, fetchMemories]);

    // Delete a memory
    const handleDelete = async (memoryId: string) => {
        if (!uid) return;
        try {
            await fetch(`/api/memory?userId=${uid}&memoryId=${memoryId}`, {
                method: "DELETE",
            });
            setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        } catch (err) {
            console.error("[MemoryManager] delete error:", err);
        }
    };

    // Start editing
    const startEdit = (memory: MemoryItem) => {
        setEditingId(memory.id!);
        setEditValue(memory.value ?? "");
    };

    // Save edit
    const saveEdit = async (memoryId: string) => {
        if (!uid) return;
        setSavingId(memoryId);
        try {
            await fetch("/api/memory", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: uid, memoryId, value: editValue }),
            });
            setMemories((prev) =>
                prev.map((m) => (m.id === memoryId ? { ...m, value: editValue } : m))
            );
            setEditingId(null);
        } catch (err) {
            console.error("[MemoryManager] save error:", err);
        } finally {
            setSavingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-32 text-neutral-500 text-sm">
                Loading memories...
            </div>
        );
    }

    if (memories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
                <div className="text-4xl">🧠</div>
                <p className="text-neutral-400 text-sm">No memories stored yet.</p>
                <p className="text-neutral-600 text-xs">
                    As you chat, the AI will learn your preferences and context.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-lg font-semibold text-white">Your Memories</h2>
                    <p className="text-xs text-neutral-500">
                        {memories.length} / 20 memories stored
                    </p>
                </div>
                <button
                    onClick={fetchMemories}
                    className="text-xs text-neutral-500 hover:text-white transition-colors px-3 py-1.5 border border-neutral-700 rounded-lg"
                >
                    Refresh
                </button>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-neutral-800 rounded-full mb-4">
                <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${(memories.length / 20) * 100}%` }}
                />
            </div>

            {memories.map((memory) => {
                const isEditing = editingId === memory.id;
                const isSaving = savingId === memory.id;
                const typeColor = TYPE_COLORS[memory.type] ?? "bg-neutral-800 text-neutral-400 border-neutral-700";
                const isTemp = memory.scope === "temporary";

                return (
                    <div
                        key={memory.id}
                        className="group bg-neutral-900 border border-neutral-800 rounded-xl p-4 hover:border-neutral-700 transition-all"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                                {/* Key + badges */}
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-md border font-mono ${typeColor}`}>
                                        {memory.type}
                                    </span>
                                    <span className="text-xs text-neutral-500 font-mono">
                                        {memory.key}
                                    </span>
                                    {isTemp && (
                                        <span className="text-xs text-amber-500 border border-amber-700/50 px-1.5 py-0.5 rounded">
                                            temporary
                                        </span>
                                    )}
                                    {memory.source === "survey" && (
                                        <span className="text-xs text-neutral-600">survey</span>
                                    )}
                                    {memory.source === "chat" && (
                                        <span className="text-xs text-neutral-600">from chat</span>
                                    )}
                                </div>

                                {/* Value — editable inline */}
                                {isEditing ? (
                                    <div className="flex gap-2 mt-1">
                                        <input
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="flex-1 bg-neutral-800 border border-neutral-600 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-neutral-400"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") saveEdit(memory.id!);
                                                if (e.key === "Escape") setEditingId(null);
                                            }}
                                        />
                                        <button
                                            onClick={() => saveEdit(memory.id!)}
                                            disabled={isSaving}
                                            className="text-xs px-3 py-1.5 bg-white text-black rounded-lg font-medium hover:bg-neutral-200 transition-colors"
                                        >
                                            {isSaving ? "..." : "Save"}
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="text-xs px-3 py-1.5 text-neutral-400 hover:text-white transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-sm text-white font-medium break-words">
                                        {memory.value ?? <span className="text-neutral-600 italic">empty</span>}
                                    </p>
                                )}

                                {/* Expiry info for temporary memories */}
                                {isTemp && memory.expiresAt && (
                                    <p className="text-xs text-neutral-600 mt-1">
                                        Expires {new Date(memory.expiresAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            {!isEditing && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEdit(memory)}
                                        className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded-lg hover:bg-neutral-800"
                                        title="Edit"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(memory.id!)}
                                        className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded-lg hover:bg-neutral-800"
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
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
