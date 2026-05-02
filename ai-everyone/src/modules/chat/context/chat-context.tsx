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
import {
    CHAT_MODELS,
    DEFAULT_CHAT_MODEL_ID,
    isLocalOllamaModel,
} from "@/lib/model-capabilities";

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
import {
    isRetryableHighTrafficGeminiError,
    normalizeUserFacingError,
} from "@/lib/errors/user-facing-errors";

interface StreamPayload {
    type: string;
    content?: string;
    audioBase64?: string;
    audioMimeType?: string;
    model?: string;
    taskId?: string;
    agentId?: string;
    status?: string;
    result?: Record<string, unknown>;
    meta?: Record<string, unknown>;
}

const AGENT_TASK_CHAT_FALLBACK_STATUSES = new Set([
    "failed",
    "needs_input",
    "action_required",
]);

function getAgentTaskFallbackText(payload: StreamPayload): string {
    const result = payload.result && typeof payload.result === "object"
        ? (payload.result as Record<string, unknown>)
        : null;
    const candidates = [
        payload.content,
        typeof result?.summary === "string" ? result.summary : "",
        typeof result?.message === "string" ? result.message : "",
        typeof result?.error === "string" ? result.error : "",
    ]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter(Boolean);

    return candidates[0] || "I could not complete that request right now.";
}

export type ChatWorkspaceScope =
    | { type: "global" }
    | { type: "agent"; agentId: string; agentName: string };

interface ChatContextValue {
    chats: Chat[];
    activeChatId: string | null;
    messages: ChatMessage[];
    workspaceScope: ChatWorkspaceScope;
    isGenerating: boolean;
    isStopping: boolean;
    isLoadingChats: boolean;
    error: string | null;
    taskStatuses: Record<string, { status: string; result?: Record<string, unknown> }>;
    selectedModel: string;
    availableModels: { id: string; label: string }[];
    isVoiceActive: boolean;
    pendingVoiceResponse: string | null;
    loadChats: (scopeOverride?: ChatWorkspaceScope) => Promise<void>;
    setWorkspaceScope: (scope: ChatWorkspaceScope) => void;
    createNewChat: () => void;
    ensureActiveChat: (options?: { seedTitle?: string }) => Promise<string | null>;
    selectChat: (chatId: string) => Promise<void>;
    sendMessage: (
        content: string,
        isVoice?: boolean,
        attachments?: ChatAttachment[],
        failedAttachments?: ChatFailedAttachment[],
        options?: {
            forceNewChat?: boolean;
            modelOverride?: string;
        }
    ) => Promise<{
        type: string;
        content?: string;
        taskId?: string;
        audioBase64?: string;
        audioMimeType?: string;
        meta?: Record<string, unknown>;
    } | undefined>;
    stopGeneration: () => void;
    removeChatById: (chatId: string) => Promise<void>;
    renameChat: (chatId: string, newTitle: string) => Promise<void>;
    setSelectedModel: (model: string) => void;
    sendAgentTrialPrompt: (prompt: string) => Promise<{ type: string; content?: string; taskId?: string } | undefined>;
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
const LOCAL_OLLAMA_URL_STORAGE_KEY = "pian.local_ollama_url";
const DEFAULT_LOCAL_OLLAMA_URLS = [
    "http://127.0.0.1:11434",
    "http://localhost:11434",
    "http://host.docker.internal:11434",
];

function normalizeHttpBaseUrl(value: string): string {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

function getLocalOllamaBaseUrlCandidates(): string[] {
    const candidates: string[] = [];
    const envCandidate = process.env.NEXT_PUBLIC_OLLAMA_BASE_URL;
    if (typeof envCandidate === "string" && envCandidate.trim()) {
        candidates.push(envCandidate.trim());
    }

    if (typeof window !== "undefined") {
        try {
            const stored = window.localStorage.getItem(LOCAL_OLLAMA_URL_STORAGE_KEY);
            if (stored && stored.trim()) candidates.push(stored.trim());
        } catch {
            // Ignore storage access errors.
        }
    }

    candidates.push(...DEFAULT_LOCAL_OLLAMA_URLS);

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
        const normalized = normalizeHttpBaseUrl(candidate);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        deduped.push(normalized);
    }
    return deduped;
}

function isAbortError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof DOMException) return error.name === "AbortError";
    if (error instanceof Error) return error.name === "AbortError";
    return false;
}

async function streamLocalOllama(
    baseUrl: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    onDelta: (delta: string) => void,
    signal: AbortSignal
): Promise<string> {
    const ollamaMessages = messages.map((message) => ({
        role: message.role === "agent" ? "assistant" : message.role,
        content: message.content,
    }));

    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages: ollamaMessages,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
            `Local Ollama at ${baseUrl} returned ${response.status}${errorText ? `: ${errorText}` : ""}`
        );
    }

    if (!response.body) {
        throw new Error(`Local Ollama at ${baseUrl} did not return a response stream.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullContent = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const payload = JSON.parse(trimmed) as { message?: { content?: string } };
            const delta = payload.message?.content || "";
            if (!delta) continue;
            fullContent += delta;
            onDelta(delta);
        }
    }

    if (buffer.trim()) {
        const payload = JSON.parse(buffer.trim()) as { message?: { content?: string } };
        const delta = payload.message?.content || "";
        if (delta) {
            fullContent += delta;
            onDelta(delta);
        }
    }

    return fullContent;
}

async function tryStreamLocalOllama(
    model: string,
    messages: Array<{ role: string; content: string }>,
    onDelta: (delta: string) => void,
    signal: AbortSignal
): Promise<string> {
    const candidates = getLocalOllamaBaseUrlCandidates();
    const errors: string[] = [];

    for (const baseUrl of candidates) {
        try {
            return await streamLocalOllama(baseUrl, model, messages, onDelta, signal);
        } catch (error) {
            if (isAbortError(error)) throw error;
            errors.push(`${baseUrl}: ${error instanceof Error ? error.message : "connection failed"}`);
        }
    }

    throw new Error(
        [
            "Could not connect to local Ollama from the browser.",
            `Tried: ${candidates.join(", ")}.`,
            "If you're using Vercel, allow your app origin in Ollama (OLLAMA_ORIGINS) and keep Ollama running on your PC.",
            errors.length > 0 ? `Details: ${errors.join(" | ")}` : "",
        ]
            .filter(Boolean)
            .join(" ")
    );
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
    const [uid, setUid] = useState<string | null>(null);
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [workspaceScope, setWorkspaceScopeState] = useState<ChatWorkspaceScope>({
        type: "global",
    });
    const [generationStateByChatId, setGenerationStateByChatId] = useState<
        Record<string, { isGenerating: boolean; isStopping: boolean }>
    >({});
    const [isLoadingChats, setIsLoadingChats] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [taskStatuses, setTaskStatuses] = useState<
        Record<string, { status: string; result?: Record<string, unknown> }>
    >({});
    const [selectedModel, setSelectedModel] = useState(() => {
        if (AVAILABLE_MODELS.some((model) => model.id === DEFAULT_CHAT_MODEL_ID)) {
            return DEFAULT_CHAT_MODEL_ID;
        }
        return AVAILABLE_MODELS[0]?.id || DEFAULT_CHAT_MODEL_ID;
    });
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [pendingVoiceResponse, setPendingVoiceResponse] = useState<string | null>(null);

    const activeChatIdRef = useRef<string | null>(activeChatId);
    const workspaceScopeRef = useRef<ChatWorkspaceScope>(workspaceScope);
    const messagesRef = useRef<ChatMessage[]>(messages);
    const messagesByChatRef = useRef<Record<string, ChatMessage[]>>({});
    const generationStateRef = useRef<
        Record<string, { isGenerating: boolean; isStopping: boolean }>
    >({});
    const abortByChatRef = useRef<Record<string, boolean>>({});
    const requestAbortControllersRef = useRef<Record<string, AbortController>>({});
    const taskListenersRef = useRef<Record<string, () => void>>({});

    useEffect(() => {
        activeChatIdRef.current = activeChatId;
    }, [activeChatId]);

    useEffect(() => {
        workspaceScopeRef.current = workspaceScope;
    }, [workspaceScope]);

    useEffect(() => {
        messagesRef.current = messages;
        if (activeChatId) {
            messagesByChatRef.current[activeChatId] = messages;
        }
    }, [activeChatId, messages]);

    useEffect(() => {
        generationStateRef.current = generationStateByChatId;
    }, [generationStateByChatId]);

    const activeGenerationState = activeChatId
        ? generationStateByChatId[activeChatId]
        : undefined;
    const isGenerating = Boolean(activeGenerationState?.isGenerating);
    const isStopping = Boolean(activeGenerationState?.isStopping);

    const setChatGenerationState = useCallback(
        (
            chatId: string,
            state: { isGenerating: boolean; isStopping: boolean } | null
        ) => {
            setGenerationStateByChatId((prev) => {
                const next = { ...prev };
                if (state) {
                    next[chatId] = state;
                } else {
                    delete next[chatId];
                }
                generationStateRef.current = next;
                return next;
            });
        },
        []
    );

    const closeVoiceSession = useCallback(
        (abortActiveRequest = false) => {
            setIsVoiceActive(false);
            setPendingVoiceResponse(null);

            if (!abortActiveRequest) return;
            const chatId = activeChatIdRef.current;
            if (!chatId || !generationStateRef.current[chatId]?.isGenerating) return;

            abortByChatRef.current[chatId] = true;
            setChatGenerationState(chatId, { isGenerating: true, isStopping: true });
            try {
                requestAbortControllersRef.current[chatId]?.abort(
                    new DOMException("Voice session closed.", "AbortError")
                );
            } catch {
                requestAbortControllersRef.current[chatId]?.abort();
            }
        },
        [setChatGenerationState]
    );

    const updateMessagesForChat = useCallback(
        (chatId: string, updater: (current: ChatMessage[]) => ChatMessage[]) => {
            const current =
                messagesByChatRef.current[chatId] ??
                (activeChatIdRef.current === chatId ? messagesRef.current : []);
            const next = updater(current);
            messagesByChatRef.current[chatId] = next;
            if (activeChatIdRef.current === chatId) {
                messagesRef.current = next;
                setMessages(next);
            }
            return next;
        },
        []
    );

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (user: User | null) => {
            setUid(user?.uid ?? null);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const taskListeners = taskListenersRef.current;
        return () => {
            Object.keys(requestAbortControllersRef.current).forEach((chatId) => {
                abortByChatRef.current[chatId] = true;
            });
            Object.values(requestAbortControllersRef.current).forEach((controller) => {
                try {
                    controller.abort(new DOMException("Chat provider unmounted.", "AbortError"));
                } catch {
                    controller.abort();
                }
            });
            Object.values(taskListeners).forEach((unsub) => unsub());
        };
    }, []);

    const loadChats = useCallback(async (scopeOverride?: ChatWorkspaceScope) => {
        if (!uid) return;
        setIsLoadingChats(true);
        try {
            const scope = scopeOverride || workspaceScopeRef.current;
            const fetched = await getChats(
                uid,
                scope.type === "agent"
                    ? { workspaceType: "agent", agentId: scope.agentId }
                    : { workspaceType: "global" }
            );
            setChats(fetched);
        } catch (err) {
            console.error("[loadChats]", err);
        } finally {
            setIsLoadingChats(false);
        }
    }, [uid]);

    const createNewChat = useCallback(() => {
        closeVoiceSession(true);
        activeChatIdRef.current = null;
        messagesRef.current = [];
        setActiveChatId(null);
        setMessages([]);
        setError(null);
    }, [closeVoiceSession]);

    const ensureActiveChat = useCallback(
        async (options?: { seedTitle?: string }): Promise<string | null> => {
            if (!uid) return null;
            if (activeChatIdRef.current) return activeChatIdRef.current;

            const currentWorkspaceScope = workspaceScopeRef.current;
            const seedTitle = options?.seedTitle?.trim();
            const title =
                seedTitle ||
                (currentWorkspaceScope.type === "agent"
                    ? `${currentWorkspaceScope.agentName} workspace`
                    : "New Chat");

            const newChat = await createChat(
                uid,
                title,
                currentWorkspaceScope.type === "agent"
                    ? {
                          workspaceType: "agent",
                          agentId: currentWorkspaceScope.agentId,
                          agentName: currentWorkspaceScope.agentName,
                      }
                    : { workspaceType: "global" }
            );

            activeChatIdRef.current = newChat.id;
            messagesRef.current = [];
            messagesByChatRef.current[newChat.id] = [];
            setActiveChatId(newChat.id);
            setMessages([]);
            setChats((prev) => [newChat, ...prev]);
            return newChat.id;
        },
        [uid]
    );

    const setWorkspaceScope = useCallback(
        (scope: ChatWorkspaceScope) => {
            const previous = workspaceScopeRef.current;
            const sameScope =
                previous.type === scope.type &&
                (previous.type !== "agent" ||
                    (scope.type === "agent" && previous.agentId === scope.agentId));

            workspaceScopeRef.current = scope;
            setWorkspaceScopeState(scope);

            if (!sameScope) {
                createNewChat();
                void loadChats(scope);
            }
        },
        [createNewChat, loadChats]
    );

    useEffect(() => {
        if (uid) {
            loadChats();
            return;
        }

        setChats([]);
        setActiveChatId(null);
        setMessages([]);
        messagesByChatRef.current = {};
        abortByChatRef.current = {};
        requestAbortControllersRef.current = {};
        setGenerationStateByChatId({});
    }, [uid, loadChats]);

    const selectChat = useCallback(
        async (chatId: string) => {
            if (!uid) return;
            if (activeChatIdRef.current !== chatId) {
                closeVoiceSession(true);
            }
            activeChatIdRef.current = chatId;
            setActiveChatId(chatId);
            setError(null);
            const cachedBeforeFetch = messagesByChatRef.current[chatId] ?? [];
            messagesRef.current = cachedBeforeFetch;
            setMessages(cachedBeforeFetch);

            try {
                const fetched = await getMessages(uid, chatId);
                if (activeChatIdRef.current !== chatId) return;

                const cached = messagesByChatRef.current[chatId];
                const nextMessages =
                    generationStateRef.current[chatId]?.isGenerating && cached?.length
                        ? cached
                        : fetched;

                messagesByChatRef.current[chatId] = nextMessages;
                messagesRef.current = nextMessages;
                setMessages(nextMessages);
            } catch (err) {
                console.error("[selectChat]", err);
                if (activeChatIdRef.current === chatId) {
                    messagesRef.current = [];
                    setMessages([]);
                }
            }
        },
        [uid, closeVoiceSession]
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
                task.status === "needs_input" ||
                task.status === "action_required" ||
                task.status === "partial_success"
            ) {
                unsub();
                delete taskListenersRef.current[taskId];
            }
        });

        taskListenersRef.current[taskId] = unsub;
    }, []);

    const stopGeneration = useCallback(() => {
        const chatId = activeChatIdRef.current;
        if (!chatId || !generationStateRef.current[chatId]?.isGenerating) return;

        abortByChatRef.current[chatId] = true;
        setChatGenerationState(chatId, { isGenerating: true, isStopping: true });
        try {
            requestAbortControllersRef.current[chatId]?.abort(
                new DOMException("User stopped generation.", "AbortError")
            );
        } catch (error) {
            console.warn("[stopGeneration] abort failed", error);
        }
    }, [setChatGenerationState]);

    const sendMessage = useCallback(
        async (
            content: string,
            isVoice?: boolean,
            attachments: ChatAttachment[] = [],
            failedAttachments: ChatFailedAttachment[] = [],
            options: {
                forceNewChat?: boolean;
                modelOverride?: string;
            } = {}
        ): Promise<{
            type: string;
            content?: string;
            taskId?: string;
            audioBase64?: string;
            audioMimeType?: string;
            meta?: Record<string, unknown>;
        } | undefined> => {
            if (!uid || !content.trim()) return undefined;

            setError(null);

            const requestModel = options.modelOverride ?? selectedModel;
            const currentWorkspaceScope = workspaceScopeRef.current;
            let currentChatId = options.forceNewChat ? null : activeChatIdRef.current;
            let tempAssistantId = "";
            let resolvedChatId: string | null = null;
            let localOllamaError: Error | null = null;

            try {
                if (options.forceNewChat) {
                    activeChatIdRef.current = null;
                    messagesRef.current = [];
                    setActiveChatId(null);
                    setMessages([]);
                }

                if (!currentChatId) {
                    const title =
                        content.length > 40 ? content.slice(0, 40) + "…" : content;
                    const newChat = await createChat(
                        uid,
                        title,
                        currentWorkspaceScope.type === "agent"
                            ? {
                                  workspaceType: "agent",
                                  agentId: currentWorkspaceScope.agentId,
                                  agentName: currentWorkspaceScope.agentName,
                              }
                            : { workspaceType: "global" }
                    );
                    currentChatId = newChat.id;
                    activeChatIdRef.current = currentChatId;
                    setActiveChatId(currentChatId);
                    setChats((prev) => [newChat, ...prev]);
                }

                if (!currentChatId) {
                    throw new Error("Failed to create or resolve a chat session.");
                }
                resolvedChatId = currentChatId;
                const resolvedChatIdValue = resolvedChatId;
                abortByChatRef.current[resolvedChatIdValue] = false;
                setChatGenerationState(resolvedChatIdValue, {
                    isGenerating: true,
                    isStopping: false,
                });

                const userMsg = await createMessage(
                    uid,
                    resolvedChatIdValue,
                    "user",
                    content,
                    undefined,
                    undefined,
                    isVoice,
                    attachments
                );
                const historySource = options.forceNewChat
                    ? []
                    : messagesByChatRef.current[resolvedChatIdValue] ??
                      (activeChatIdRef.current === resolvedChatIdValue
                          ? messagesRef.current
                          : []);
                updateMessagesForChat(resolvedChatIdValue, (prev) =>
                    options.forceNewChat ? [userMsg] : [...prev, userMsg]
                );

                const historyForApi = [
                    ...historySource.map((message) => ({
                        role: message.role,
                        content: message.content,
                        isVoice: message.isVoice,
                        taskId: message.taskId,
                        agentId: message.agentId,
                    })),
                    { role: "user" as const, content, isVoice },
                ];

                tempAssistantId = `temp_${Date.now()}`;
                updateMessagesForChat(resolvedChatIdValue, (prev) => [
                    ...(options.forceNewChat ? [userMsg] : prev),
                    {
                        id: tempAssistantId,
                        chatId: resolvedChatIdValue,
                        role: "assistant",
                        content: "",
                        createdAt: new Date().toISOString(),
                    },
                ]);

                const controller = new AbortController();
                requestAbortControllersRef.current[resolvedChatIdValue] = controller;

                const isLocalModelSelected =
                    currentWorkspaceScope.type === "global" &&
                    isLocalOllamaModel(requestModel);
                if (isLocalModelSelected) {
                    if (attachments.length > 0) {
                        throw new Error(
                            "File attachments are not supported with local Ollama mode yet. Please use a Gemini model for file uploads."
                        );
                    }

                    try {
                        let streamedAssistantContent = "";
                        const localContent = await tryStreamLocalOllama(
                            requestModel,
                            historyForApi.map((message) => ({
                                role: message.role,
                                content: message.content,
                            })),
                            (delta) => {
                                streamedAssistantContent += delta;
                                updateMessagesForChat(resolvedChatIdValue, (prev) =>
                                    prev.map((message) =>
                                        message.id === tempAssistantId
                                            ? { ...message, content: streamedAssistantContent }
                                            : message
                                    )
                                );
                            },
                            controller.signal
                        );

                        if (abortByChatRef.current[resolvedChatIdValue]) return;

                        const assistantContent =
                            localContent || "No response received from local Ollama.";
                        const assistantMsg = await createMessage(
                            uid,
                            resolvedChatIdValue,
                            "assistant",
                            assistantContent,
                            undefined,
                            undefined,
                            isVoice,
                            [],
                            {
                                runtime: "browser_local_ollama",
                                model: requestModel,
                            }
                        );
                        updateMessagesForChat(resolvedChatIdValue, (prev) =>
                            prev.map((message) =>
                                message.id === tempAssistantId ? assistantMsg : message
                            )
                        );
                        await updateChat(uid, resolvedChatIdValue, {});
                        return { type: "chat", content: assistantContent };
                    } catch (error) {
                        if (isAbortError(error) || abortByChatRef.current[resolvedChatIdValue]) {
                            throw error;
                        }
                        localOllamaError =
                            error instanceof Error
                                ? error
                                : new Error("Local Ollama browser streaming failed.");
                        console.warn(
                            "[sendMessage] local Ollama attempt failed, falling back to /api/chat",
                            localOllamaError
                        );
                    }
                }

                const token = await auth.currentUser?.getIdToken();
                if (!token) {
                    throw new Error("Authentication expired. Please sign in again.");
                }

                const endpoint =
                    currentWorkspaceScope.type === "agent"
                        ? `/api/agents/${encodeURIComponent(currentWorkspaceScope.agentId)}/chat`
                        : "/api/chat";

                const res = await fetch(endpoint, {
                    method: "POST",
                    signal: controller.signal,
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        messages: historyForApi,
                        chatId: resolvedChatIdValue,
                        model: requestModel,
                        attachments,
                        failedAttachments,
                        workspace:
                            currentWorkspaceScope.type === "agent"
                                ? {
                                      type: "agent",
                                      agentId: currentWorkspaceScope.agentId,
                                      agentName: currentWorkspaceScope.agentName,
                                  }
                                : { type: "global" },
                    }),
                });

                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    const apiError = new Error(errData.error || `API returned status ${res.status}`) as Error & {
                        status?: number;
                    };
                    apiError.status = res.status;
                    throw apiError;
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
                let sawAudioDelta = false;
                const voiceAudioPayloadRef: {
                    current: Pick<StreamPayload, "audioBase64" | "audioMimeType"> | null;
                } = { current: null };

                const processEvent = (eventName: string, dataLine: string) => {
                    const payload = JSON.parse(dataLine.substring(6)) as StreamPayload & {
                        error?: string;
                    };

                    if (eventName === "text") {
                        streamedAssistantContent += payload.content || "";
                        updateMessagesForChat(resolvedChatIdValue, (prev) =>
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

                    if (eventName === "audio") {
                        voiceAudioPayloadRef.current = {
                            audioBase64: payload.audioBase64,
                            audioMimeType: payload.audioMimeType,
                        };
                        return;
                    }

                    if (eventName === "audio_delta") {
                        sawAudioDelta = true;
                        window.dispatchEvent(
                            new CustomEvent("pian:voice-audio-delta", {
                                detail: {
                                    chatId: resolvedChatIdValue,
                                    audioBase64: payload.audioBase64,
                                    audioMimeType: payload.audioMimeType,
                                    model: payload.model,
                                },
                            })
                        );
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

                if (abortByChatRef.current[resolvedChatIdValue]) return;

                const resolvedPayload: StreamPayload =
                    agentTaskPayload ??
                    finalPayload ?? {
                        type: "chat",
                        content: streamedAssistantContent || "No response received.",
                    };
                const returnPayload: StreamPayload = { ...resolvedPayload };
                if (sawAudioDelta) {
                    returnPayload.meta = {
                        ...(returnPayload.meta || {}),
                        voiceAudioStreamed: true,
                    };
                }
                const voiceAudioPayload = voiceAudioPayloadRef.current;
                if (voiceAudioPayload?.audioBase64) {
                    returnPayload.audioBase64 = voiceAudioPayload.audioBase64;
                    returnPayload.audioMimeType = voiceAudioPayload.audioMimeType;
                }

                const shouldCollapseAgentTaskToChat =
                    resolvedPayload.type === "agent_task" &&
                    AGENT_TASK_CHAT_FALLBACK_STATUSES.has(
                        String(resolvedPayload.status || "").toLowerCase()
                    );

                if (shouldCollapseAgentTaskToChat) {
                    const assistantContent = getAgentTaskFallbackText(resolvedPayload);
                    const assistantMsg = await createMessage(
                        uid,
                        resolvedChatIdValue,
                        "assistant",
                        assistantContent,
                        undefined,
                        undefined,
                        isVoice,
                        [],
                        resolvedPayload.meta && typeof resolvedPayload.meta === "object"
                            ? {
                                ...resolvedPayload.meta,
                                collapsedAgentTask: true,
                                originalAgentId: resolvedPayload.agentId,
                                originalTaskStatus: resolvedPayload.status,
                            }
                            : {
                                collapsedAgentTask: true,
                                originalAgentId: resolvedPayload.agentId,
                                originalTaskStatus: resolvedPayload.status,
                            }
                    );
                    updateMessagesForChat(resolvedChatIdValue, (prev) =>
                        prev.map((message) =>
                            message.id === tempAssistantId ? assistantMsg : message
                        )
                    );
                    await updateChat(uid, resolvedChatIdValue, {});
                    return {
                        type: "chat",
                        content: assistantContent,
                        meta: assistantMsg.meta as Record<string, unknown> | undefined,
                    };
                }

                if (
                    resolvedPayload.type === "agent_task" &&
                    resolvedPayload.taskId &&
                    resolvedPayload.agentId
                ) {
                    const agentMsg = await createMessage(
                        uid,
                        resolvedChatIdValue,
                        "agent",
                        resolvedPayload.content || "Processing agent task...",
                        resolvedPayload.taskId,
                        resolvedPayload.agentId,
                        isVoice
                    );
                    updateMessagesForChat(resolvedChatIdValue, (prev) => [
                        ...prev.filter((message) => message.id !== tempAssistantId),
                        agentMsg,
                    ]);

                    setTaskStatuses((prev) => ({
                        ...prev,
                        [resolvedPayload.taskId!]: {
                            status: resolvedPayload.status || "queued",
                            result: resolvedPayload.result,
                        },
                    }));

                    watchTask(resolvedPayload.taskId);
                } else {
                    const assistantContent =
                        resolvedPayload.content || streamedAssistantContent || "No response received.";

                    const assistantMsg = await createMessage(
                        uid,
                        resolvedChatIdValue,
                        "assistant",
                        assistantContent,
                        undefined,
                        undefined,
                        isVoice,
                        [],
                        resolvedPayload.meta && typeof resolvedPayload.meta === "object"
                            ? resolvedPayload.meta
                            : undefined
                    );
                    updateMessagesForChat(resolvedChatIdValue, (prev) =>
                        prev.map((message) =>
                            message.id === tempAssistantId ? assistantMsg : message
                        )
                    );
                }

                await updateChat(uid, resolvedChatIdValue, {});

                return returnPayload;
            } catch (err: unknown) {
                console.error("[sendMessage]", err);
                const aborted =
                    (err instanceof DOMException && err.name === "AbortError") ||
                    (err instanceof Error && err.name === "AbortError") ||
                    Boolean(resolvedChatId && abortByChatRef.current[resolvedChatId]);

                if (aborted) {
                    // Keep partial response if any text already streamed; otherwise remove placeholder.
                    if (resolvedChatId) {
                        updateMessagesForChat(resolvedChatId, (prev) =>
                            prev.filter((message) =>
                                message.id === tempAssistantId
                                    ? Boolean(message.content?.trim())
                                    : true
                            )
                        );
                    }
                    return { type: "aborted" };
                }

                const parsedError = normalizeUserFacingError(err, {
                    surface: "chat",
                    fallbackMessage: "Failed to send message.",
                });

                if (tempAssistantId) {
                    if (resolvedChatId && isRetryableHighTrafficGeminiError(parsedError)) {
                        const assistantMsg = await createMessage(
                            uid,
                            resolvedChatId,
                            "assistant",
                            parsedError.message,
                            undefined,
                            undefined,
                            isVoice
                        );
                        updateMessagesForChat(resolvedChatId, (prev) =>
                            prev.map((message) =>
                                message.id === tempAssistantId ? assistantMsg : message
                            )
                        );
                        return { type: "chat", content: parsedError.message };
                    }

                    if (resolvedChatId) {
                        updateMessagesForChat(resolvedChatId, (prev) =>
                            prev.filter((message) => message.id !== tempAssistantId)
                        );
                    }
                }

                if (localOllamaError) {
                    const localFallback = normalizeUserFacingError(localOllamaError, {
                        surface: "chat",
                    });
                    if (!resolvedChatId || activeChatIdRef.current === resolvedChatId) {
                        setError(
                            `${parsedError.message}\n\nLocal Ollama attempt also failed: ${localFallback.message}`
                        );
                    }
                } else if (!resolvedChatId || activeChatIdRef.current === resolvedChatId) {
                    setError(parsedError.message);
                }
                return undefined;
            } finally {
                if (resolvedChatId) {
                    delete requestAbortControllersRef.current[resolvedChatId];
                    abortByChatRef.current[resolvedChatId] = false;
                    setChatGenerationState(resolvedChatId, null);
                }
            }
        },
        [uid, watchTask, selectedModel, setChatGenerationState, updateMessagesForChat]
    );

    const sendAgentTrialPrompt = useCallback(
        async (prompt: string) => {
            setSelectedModel(DEFAULT_CHAT_MODEL_ID);
            createNewChat();
            return sendMessage(prompt, false, [], [], {
                forceNewChat: true,
                modelOverride: DEFAULT_CHAT_MODEL_ID,
            });
        },
        [createNewChat, sendMessage]
    );

    const removeChatById = useCallback(
        async (chatId: string) => {
            if (!uid) return;
            try {
                abortByChatRef.current[chatId] = true;
                try {
                    requestAbortControllersRef.current[chatId]?.abort(
                        new DOMException("Chat deleted.", "AbortError")
                    );
                } catch {
                    requestAbortControllersRef.current[chatId]?.abort();
                }
                await deleteMessages(uid, chatId);
                await deleteChatDoc(uid, chatId);
                setChats((prev) => prev.filter((chat) => chat.id !== chatId));
                delete messagesByChatRef.current[chatId];
                delete requestAbortControllersRef.current[chatId];
                delete abortByChatRef.current[chatId];
                setChatGenerationState(chatId, null);

                if (activeChatId === chatId) {
                    activeChatIdRef.current = null;
                    messagesRef.current = [];
                    setActiveChatId(null);
                    setMessages([]);
                }
            } catch (err) {
                console.error("[deleteChat]", err);
            }
        },
        [uid, activeChatId, setChatGenerationState]
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
        workspaceScope,
        isGenerating,
        isStopping,
        isLoadingChats,
        error,
        taskStatuses,
        selectedModel,
        availableModels: AVAILABLE_MODELS,
        isVoiceActive,
        pendingVoiceResponse,
        loadChats,
        setWorkspaceScope,
        createNewChat,
        ensureActiveChat,
        selectChat,
        sendMessage,
        stopGeneration,
        removeChatById,
        renameChat,
        setSelectedModel,
        sendAgentTrialPrompt,
        setIsVoiceActive,
        setPendingVoiceResponse,
        clearError,
    };

    return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
