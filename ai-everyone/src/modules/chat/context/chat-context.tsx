/**
 * ChatProvider - global chat state management.
 *
 * Provides chat state, streaming sendMessage, and task-status listeners.
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
import { CHAT_MODELS } from "@/lib/model-capabilities";

import type {
    Chat,
    ChatMessage,
    ChatAttachment,
    ChatFailedAttachment,
} from "@/modules/chat/types";
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

interface StreamPayload {
    type: string;
    content?: string;
    taskId?: string;
    agentId?: string;
    status?: string;
}

interface ChatContextValue {
    chats: Chat[];
    activeChatId: string | null;
    messages: ChatMessage[];
    isGenerating: boolean;
    isLoadingChats: boolean;
    error: string | null;
    taskStatuses: Record<string, { status: string; result?: Record<string, unknown> }>;
    selectedModel: string;
    availableModels: { id: string; label: string }[];
    isVoiceActive: boolean;
    pendingVoiceResponse: string | null;
    loadChats: () => Promise<void>;
    createNewChat: () => void;
    selectChat: (chatId: string) => Promise<void>;
    sendMessage: (
        content: string,
        isVoice?: boolean,
        attachments?: ChatAttachment[],
        failedAttachments?: ChatFailedAttachment[]
    ) => Promise<{ type: string; content?: string; taskId?: string } | undefined>;
    removeChatById: (chatId: string) => Promise<void>;
    renameChat: (chatId: string, newTitle: string) => Promise<void>;
    setSelectedModel: (model: string) => void;
    setIsVoiceActive: (active: boolean) => void;
    setPendingVoiceResponse: (text: string | null) => void;
    clearError: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
    const ctx = useContext(ChatContext);
    if (!ctx) {
        throw new Error("useChatContext must be used within a <ChatProvider>");
    }
    return ctx;
}

const AVAILABLE_MODELS = CHAT_MODELS.map((model) => ({
    id: model.id,
    label: model.label,
}));

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const [uid, setUid] = useState<string | null>(null);
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
    const [pendingVoiceResponse, setPendingVoiceResponse] = useState<string | null>(null);

    const abortRef = useRef(false);
    const taskListenersRef = useRef<Record<string, () => void>>({});

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user: User | null) => {
            setUid(user?.uid ?? null);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        return () => {
            Object.values(taskListenersRef.current).forEach((unsub) => unsub());
        };
    }, []);

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

    useEffect(() => {
        if (uid) {
            loadChats();
            return;
        }

        setChats([]);
        setActiveChatId(null);
        setMessages([]);
    }, [uid, loadChats]);

    const createNewChat = useCallback(() => {
        setActiveChatId(null);
        setMessages([]);
        setError(null);
    }, []);

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

    const watchTask = useCallback((taskId: string) => {
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

            if (
                task.status === "success" ||
                task.status === "failed" ||
                task.status === "needs_input"
            ) {
                unsub();
                delete taskListenersRef.current[taskId];
            }
        });

        taskListenersRef.current[taskId] = unsub;
    }, []);

    const sendMessage = useCallback(
        async (
            content: string,
            isVoice?: boolean,
            attachments: ChatAttachment[] = [],
            failedAttachments: ChatFailedAttachment[] = []
        ): Promise<{ type: string; content?: string; taskId?: string } | undefined> => {
            if (!uid || !content.trim()) return undefined;

            setIsGenerating(true);
            setError(null);
            abortRef.current = false;

            let currentChatId = activeChatId;
            let tempAssistantId = "";

            try {
                if (!currentChatId) {
                    const title =
                        content.length > 40 ? content.slice(0, 40) + "…" : content;
                    const newChat = await createChat(uid, title);
                    currentChatId = newChat.id;
                    setActiveChatId(currentChatId);
                    setChats((prev) => [newChat, ...prev]);
                }

                if (!currentChatId) {
                    throw new Error("Failed to create or resolve a chat session.");
                }
                const resolvedChatId = currentChatId;

                const userMsg = await createMessage(
                    uid,
                    resolvedChatId,
                    "user",
                    content,
                    undefined,
                    undefined,
                    isVoice,
                    attachments
                );
                setMessages((prev) => [...prev, userMsg]);

                const historyForApi = [
                    ...messages.map((message) => ({
                        role: message.role,
                        content: message.content,
                        isVoice: message.isVoice,
                    })),
                    { role: "user" as const, content, isVoice },
                ];

                tempAssistantId = `temp_${Date.now()}`;
                setMessages((prev) => [
                    ...prev,
                    {
                        id: tempAssistantId,
                        chatId: resolvedChatId,
                        role: "assistant",
                        content: "",
                        createdAt: new Date().toISOString(),
                    },
                ]);

                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    throw new Error("Authentication expired. Please sign in again.");
                }

                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        messages: historyForApi,
                        chatId: resolvedChatId,
                        model: selectedModel,
                        attachments,
                        failedAttachments,
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || `API returned status ${res.status}`);
                }

                if (!res.body) {
                    throw new Error("The chat response did not include a stream.");
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let currentEvent = "";
                let streamedAssistantContent = "";
                let finalPayload: StreamPayload | null = null;
                let agentTaskPayload: StreamPayload | null = null;

                const processEvent = (eventName: string, dataLine: string) => {
                    const payload = JSON.parse(dataLine.substring(6)) as StreamPayload & {
                        error?: string;
                    };

                    if (eventName === "text") {
                        streamedAssistantContent += payload.content || "";
                        setMessages((prev) =>
                            prev.map((message) =>
                                message.id === tempAssistantId
                                    ? { ...message, content: streamedAssistantContent }
                                    : message
                            )
                        );
                        return;
                    }

                    if (eventName === "agent_task") {
                        agentTaskPayload = payload;
                        return;
                    }

                    if (eventName === "done") {
                        finalPayload = payload;
                        return;
                    }

                    if (eventName === "error") {
                        throw new Error(payload.error || "Streaming failed.");
                    }
                };

                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split("\n");
                    buffer = lines.pop() || "";

                    for (const line of lines) {
                        if (line.startsWith("event: ")) {
                            currentEvent = line.substring(7).trim();
                        } else if (line.startsWith("data: ")) {
                            processEvent(currentEvent, line);
                            currentEvent = "";
                        }
                    }
                }

                if (buffer.trim()) {
                    const lines = buffer.trim().split("\n");
                    let eventName = currentEvent;
                    for (const line of lines) {
                        if (line.startsWith("event: ")) {
                            eventName = line.substring(7).trim();
                        } else if (line.startsWith("data: ")) {
                            processEvent(eventName, line);
                        }
                    }
                }

                if (abortRef.current) return;

                const resolvedPayload: StreamPayload =
                    agentTaskPayload ??
                    finalPayload ?? {
                        type: "chat",
                        content: streamedAssistantContent || "No response received.",
                    };

                if (
                    resolvedPayload.type === "agent_task" &&
                    resolvedPayload.taskId &&
                    resolvedPayload.agentId
                ) {
                    const agentMsg = await createMessage(
                        uid,
                        resolvedChatId,
                        "agent",
                        resolvedPayload.content || "Processing agent task...",
                        resolvedPayload.taskId,
                        resolvedPayload.agentId,
                        isVoice
                    );
                    setMessages((prev) => [
                        ...prev.filter((message) => message.id !== tempAssistantId),
                        agentMsg,
                    ]);

                    setTaskStatuses((prev) => ({
                        ...prev,
                        [resolvedPayload.taskId!]: {
                            status: resolvedPayload.status || "queued",
                        },
                    }));

                    watchTask(resolvedPayload.taskId);
                } else {
                    const assistantContent =
                        resolvedPayload.content || streamedAssistantContent || "No response received.";

                    const assistantMsg = await createMessage(
                        uid,
                        resolvedChatId,
                        "assistant",
                        assistantContent,
                        undefined,
                        undefined,
                        isVoice
                    );
                    setMessages((prev) =>
                        prev.map((message) =>
                            message.id === tempAssistantId ? assistantMsg : message
                        )
                    );
                }

                await updateChat(uid, resolvedChatId, {});
                setIsGenerating(false);

                return resolvedPayload;
            } catch (err: unknown) {
                console.error("[sendMessage]", err);
                if (tempAssistantId) {
                    setMessages((prev) =>
                        prev.filter((message) => message.id !== tempAssistantId)
                    );
                }
                setError(
                    err instanceof Error ? err.message : "Failed to send message."
                );
                setIsGenerating(false);
                return undefined;
            }
        },
        [uid, activeChatId, messages, watchTask, selectedModel]
    );

    const removeChatById = useCallback(
        async (chatId: string) => {
            if (!uid) return;
            try {
                await deleteMessages(uid, chatId);
                await deleteChatDoc(uid, chatId);
                setChats((prev) => prev.filter((chat) => chat.id !== chatId));

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

    const renameChat = useCallback(
        async (chatId: string, newTitle: string) => {
            if (!uid) return;
            try {
                await updateChat(uid, chatId, { title: newTitle });
                setChats((prev) =>
                    prev.map((chat) => (chat.id === chatId ? { ...chat, title: newTitle } : chat))
                );
            } catch (err) {
                console.error("[renameChat]", err);
            }
        },
        [uid]
    );

    const clearError = useCallback(() => setError(null), []);

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
        pendingVoiceResponse,
        loadChats,
        createNewChat,
        selectChat,
        sendMessage,
        removeChatById,
        renameChat,
        setSelectedModel,
        setIsVoiceActive,
        setPendingVoiceResponse,
        clearError,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
