/**
 * ChatProvider — global chat state management.
 *
 * Simplified adaptation of Chatbot-UI's context.tsx + global-state.tsx.
 * Provides all chat-related state and actions to child components
 * via React Context.
 *
 * State includes:
 *  - List of user's chats (sidebar)
 *  - Active chat ID and its messages
 *  - Loading / generating flags
 *
 * Actions include:
 *  - loadChats, createNewChat, selectChat, sendMessage, deleteChat, renameChat
 */

"use client";

import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    useEffect,
    useRef,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

import type { Chat, ChatMessage } from "@/modules/chat/types";
import {
    createChat,
    getChats,
    updateChat,
    deleteChat as deleteChatDoc,
} from "@/modules/chat/db/chats";
import {
    createMessage,
    getMessages,
    deleteMessages,
} from "@/modules/chat/db/messages";
import { subscribeToTask } from "@/lib/firestore-tasks";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ChatContextValue {
    /** All chats for the current user (sidebar list). */
    chats: Chat[];
    /** Currently active/selected chat ID. */
    activeChatId: string | null;
    /** Messages in the active chat. */
    messages: ChatMessage[];
    /** Whether the AI is currently generating a response. */
    isGenerating: boolean;
    /** Whether chats are being loaded from Firestore. */
    isLoadingChats: boolean;
    /** Error message from the last API call, if any. */
    error: string | null;
    /** Map of active task statuses for real-time UI updates. */
    taskStatuses: Record<string, { status: string; result?: Record<string, unknown> }>;
    /** Currently selected LLM model. */
    selectedModel: string;
    /** Available models the user can pick from. */
    availableModels: { id: string; label: string }[];
    /** Whether the voice input bar is currently active. */
    isVoiceActive: boolean;

    // Actions
    loadChats: () => Promise<void>;
    createNewChat: () => void;
    selectChat: (chatId: string) => Promise<void>;
    sendMessage: (content: string, isVoice?: boolean) => Promise<{ type: string; content?: string; taskId?: string } | undefined>;
    removeChatById: (chatId: string) => Promise<void>;
    renameChat: (chatId: string, newTitle: string) => Promise<void>;
    setSelectedModel: (model: string) => void;
    setIsVoiceActive: (active: boolean) => void;
    clearError: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChatContext(): ChatContextValue {
    const ctx = useContext(ChatContext);
    if (!ctx) {
        throw new Error("useChatContext must be used within a <ChatProvider>");
    }
    return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Available models for the selector dropdown
const AVAILABLE_MODELS = [
    { id: "qwen3.5:397b-cloud", label: "Cloud · High Accuracy" },
    { id: "qwen2.5:7b", label: "Local · Fast" },
];

export function ChatProvider({ children }: { children: React.ReactNode }) {
    // Auth state — we need the UID for all Firestore operations.
    const [uid, setUid] = useState<string | null>(null);

    // Chat state
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<
        Record<string, { status: string; result?: Record<string, unknown> }>
    >({});
    const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].id);
    const [isVoiceActive, setIsVoiceActive] = useState(false);

    // Ref to track whether the user aborted the current generation.
    const abortRef = useRef(false);
    // Ref to track active task listeners for cleanup.
    const taskListenersRef = useRef<Record<string, () => void>>({});

    // ── Auth listener ────────────────────────────────────────────────────
    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user: User | null) => {
            setUid(user?.uid ?? null);
        });
        return () => unsub();
    }, []);

    // Cleanup task listeners on unmount
    useEffect(() => {
        return () => {
            Object.values(taskListenersRef.current).forEach((unsub) => unsub());
        };
    }, []);

    // ── Load chats on login ──────────────────────────────────────────────
    const loadChats = useCallback(async () => {
        if (!uid) return;
        setIsLoadingChats(true);
        try {
            const fetched = await getChats(uid);
            setChats(fetched);
        } catch (err) {
            console.error("[loadChats]", err);
        } finally {
            setIsLoadingChats(false);
        }
    }, [uid]);

    // Auto-load chats when user logs in.
    useEffect(() => {
        if (uid) {
            loadChats();
        } else {
            // User logged out — clear state.
            setChats([]);
            setActiveChatId(null);
            setMessages([]);
        }
    }, [uid, loadChats]);

    // ── Create new chat ──────────────────────────────────────────────────
    const createNewChat = useCallback(() => {
        // Simply reset to the "no chat selected" state.
        // The actual Firestore document will be created when the first message is sent.
        setActiveChatId(null);
        setMessages([]);
        setError(null);
    }, []);

    // ── Select / switch chat ─────────────────────────────────────────────
    const selectChat = useCallback(
        async (chatId: string) => {
            if (!uid) return;
            setActiveChatId(chatId);
            setError(null);

            try {
                const fetched = await getMessages(uid, chatId);
                setMessages(fetched);
            } catch (err) {
                console.error("[selectChat]", err);
                setMessages([]);
            }
        },
        [uid]
    );

    // ── Subscribe to a task for real-time status updates ─────────────────
    const watchTask = useCallback((taskId: string) => {
        // Don't subscribe twice
        if (taskListenersRef.current[taskId]) return;

        const unsub = subscribeToTask(taskId, (task) => {
            if (!task) return;
            setTaskStatuses((prev) => ({
                ...prev,
                [taskId]: {
                    status: task.status,
                    result: task.agentOutput as Record<string, unknown> | undefined,
                },
            }));

            // Cleanup listener once task is terminal
            if (task.status === "success" || task.status === "failed") {
                unsub();
                delete taskListenersRef.current[taskId];
            }
        });

        taskListenersRef.current[taskId] = unsub;
    }, []);

    // ── Send message ─────────────────────────────────────────────────────
    const sendMessage = useCallback(
        async (content: string, isVoice?: boolean): Promise<{ type: string; content?: string; taskId?: string } | undefined> => {
            if (!uid || !content.trim()) return undefined;

            setIsGenerating(true);
            setError(null);
            abortRef.current = false;

            let currentChatId = activeChatId;

            try {
                // 1. If there's no active chat, create one in Firestore first.
                if (!currentChatId) {
                    const title =
                        content.length > 40 ? content.slice(0, 40) + "…" : content;
                    const newChat = await createChat(uid, title);
                    currentChatId = newChat.id;
                    setActiveChatId(currentChatId);
                    setChats((prev) => [newChat, ...prev]);
                }

                // 2. Save the user message to Firestore.
                const userMsg = await createMessage(
                    uid,
                    currentChatId,
                    "user",
                    content,
                    undefined,
                    undefined,
                    isVoice
                );
                setMessages((prev) => [...prev, userMsg]);

                // 3. Build message history for the API call.
                const historyForApi = [
                    ...messages.map((m) => ({ role: m.role, content: m.content, isVoice: m.isVoice })),
                    { role: "user" as const, content, isVoice },
                ];

                // 4. Call the /api/chat route — now with userId, chatId, and
                //    the user's selected model.
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        messages: historyForApi,
                        userId: uid,
                        chatId: currentChatId,
                        model: selectedModel,
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(
                        errData.error || `API returned status ${res.status}`
                    );
                }

                const data = await res.json();

                if (abortRef.current) return;

                if (data.type === "agent_task") {
                    // ── Agent task was created ────────────────────────────
                    const agentMsg = await createMessage(
                        uid,
                        currentChatId,
                        "agent",
                        data.content || "Processing agent task...",
                        data.taskId,
                        data.agentId,
                        isVoice
                    );
                    setMessages((prev) => [...prev, agentMsg]);

                    // Set initial task status
                    setTaskStatuses((prev) => ({
                        ...prev,
                        [data.taskId]: { status: data.status || "queued" },
                    }));

                    // Start real-time listener for task updates
                    watchTask(data.taskId);
                } else {
                    // ── Normal chat response ─────────────────────────────
                    const assistantContent: string =
                        data.content || "No response received.";

                    const assistantMsg = await createMessage(
                        uid,
                        currentChatId,
                        "assistant",
                        assistantContent,
                        undefined,
                        undefined,
                        isVoice
                    );
                    setMessages((prev) => [...prev, assistantMsg]);
                }

                // Touch the chat's updatedAt so it bubbles to the top of the sidebar.
                await updateChat(uid, currentChatId, {});
                
                setIsGenerating(false);
                return data; // Return data so callers (like VoiceModal) can handle audio feedback
            } catch (err: unknown) {
                console.error("[sendMessage]", err);
                setError(
                    err instanceof Error ? err.message : "Failed to send message."
                );
                setIsGenerating(false);
                return undefined;
            }
        },
        [uid, activeChatId, messages, watchTask, selectedModel]
    );

    // ── Delete chat ──────────────────────────────────────────────────────
    const removeChatById = useCallback(
        async (chatId: string) => {
            if (!uid) return;
            try {
                // Delete all messages first, then the chat document.
                await deleteMessages(uid, chatId);
                await deleteChatDoc(uid, chatId);
                setChats((prev) => prev.filter((c) => c.id !== chatId));

                // If the deleted chat was active, reset the view.
                if (activeChatId === chatId) {
                    setActiveChatId(null);
                    setMessages([]);
                }
            } catch (err) {
                console.error("[deleteChat]", err);
            }
        },
        [uid, activeChatId]
    );

    // ── Rename chat ──────────────────────────────────────────────────────
    const renameChat = useCallback(
        async (chatId: string, newTitle: string) => {
            if (!uid) return;
            try {
                await updateChat(uid, chatId, { title: newTitle });
                setChats((prev) =>
                    prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
                );
            } catch (err) {
                console.error("[renameChat]", err);
            }
        },
        [uid]
    );

    // ── Clear error ──────────────────────────────────────────────────────
    const clearError = useCallback(() => setError(null), []);

    // ── Provide ──────────────────────────────────────────────────────────
    const value: ChatContextValue = {
        chats,
        activeChatId,
        messages,
        isGenerating,
        isLoadingChats,
        error,
        taskStatuses,
        selectedModel,
        availableModels: AVAILABLE_MODELS,
        isVoiceActive,
        loadChats,
        createNewChat,
        selectChat,
        sendMessage,
        removeChatById,
        renameChat,
        setSelectedModel,
        setIsVoiceActive,
        clearError,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
