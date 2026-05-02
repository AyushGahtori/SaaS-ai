/**
 * Global state store using Zustand.
 * Manages sessions, messages, streaming state, and agent activity.
 */
import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";
import type {
  Session,
  Message,
  AgentActivity,
  AgentPhase,
  SSEEvent,
  GeneratedContent,
  ContentType,
  Platform,
} from "@/types";
import {
  createSession,
  listSessions,
  deleteSession,
  getChatHistory,
  uploadImage,
  createChatStream,
  getImageUrl,
} from "@/lib/api";

interface ChatStore {
  // ── State ──────────────────────────────────────────────────────────────────
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>; // keyed by sessionId
  isStreaming: boolean;
  agentActivity: AgentActivity | null;
  pendingImageId: string | null;
  pendingImagePreview: string | null;
  sidebarOpen: boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  loadSessions: () => Promise<void>;
  createNewSession: (name?: string) => Promise<string>;
  selectSession: (sessionId: string) => Promise<void>;
  removeSession: (sessionId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  uploadProductImage: (file: File) => Promise<void>;
  clearPendingImage: () => void;
  toggleSidebar: () => void;
  setMessages: (sessionId: string, messages: Message[]) => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: {},
  isStreaming: false,
  agentActivity: null,
  pendingImageId: null,
  pendingImagePreview: null,
  sidebarOpen: true,

  // ── Load Sessions ──────────────────────────────────────────────────────────
  loadSessions: async () => {
    try {
      const sessions = await listSessions();
      set({ sessions });
    } catch (e) {
      console.error("Failed to load sessions:", e);
    }
  },

  // ── Create Session ─────────────────────────────────────────────────────────
  createNewSession: async (name?: string) => {
    const session = await createSession(name);
    set((s) => ({
      sessions: [session, ...s.sessions],
      activeSessionId: session.session_id,
      messages: { ...s.messages, [session.session_id]: [] },
    }));
    return session.session_id;
  },

  // ── Select Session ─────────────────────────────────────────────────────────
  selectSession: async (sessionId: string) => {
    set({ activeSessionId: sessionId, agentActivity: null });

    // Load history if not already loaded
    const existing = get().messages[sessionId];
    if (!existing || existing.length === 0) {
      try {
        const { messages } = await getChatHistory(sessionId);
        const parsed: Message[] = messages.map((m: any) => ({
          id: m.id || uuidv4(),
          role: m.role,
          content: m.content,
          imageId: m.image_id,
          imageUrl: m.image_id ? getImageUrl(m.image_id) : undefined,
          timestamp: new Date(m.created_at),
          generatedContent: [],
        }));
        set((s) => ({ messages: { ...s.messages, [sessionId]: parsed } }));
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    }
  },

  // ── Remove Session ─────────────────────────────────────────────────────────
  removeSession: async (sessionId: string) => {
    await deleteSession(sessionId);
    set((s) => {
      const newSessions = s.sessions.filter((sess) => sess.session_id !== sessionId);
      const newMessages = { ...s.messages };
      delete newMessages[sessionId];
      return {
        sessions: newSessions,
        messages: newMessages,
        activeSessionId:
          s.activeSessionId === sessionId
            ? newSessions[0]?.session_id ?? null
            : s.activeSessionId,
      };
    });
  },

  // ── Upload Product Image ───────────────────────────────────────────────────
  uploadProductImage: async (file: File) => {
    const { activeSessionId } = get();
    if (!activeSessionId) throw new Error("No active session");

    const preview = URL.createObjectURL(file);
    set({ pendingImagePreview: preview });

    const res = await uploadImage(file, activeSessionId);
    set({ pendingImageId: res.image_id, pendingImagePreview: preview });
  },

  clearPendingImage: () => {
    const preview = get().pendingImagePreview;
    if (preview) URL.revokeObjectURL(preview);
    set({ pendingImageId: null, pendingImagePreview: null });
  },

  // ── Send Message ───────────────────────────────────────────────────────────
  sendMessage: async (content: string) => {
    const { activeSessionId, pendingImageId, pendingImagePreview } = get();
    if (!activeSessionId || get().isStreaming) return;

    // Add user message immediately
    const userMsg: Message = {
      id: uuidv4(),
      role: "user",
      content,
      imageId: pendingImageId ?? undefined,
      imageUrl: pendingImageId
        ? getImageUrl(pendingImageId)
        : pendingImagePreview ?? undefined,
      timestamp: new Date(),
    };

    // Add placeholder assistant message for streaming
    const assistantMsgId = uuidv4();
    const assistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
      generatedContent: [],
    };

    set((s) => ({
      messages: {
        ...s.messages,
        [activeSessionId]: [
          ...(s.messages[activeSessionId] || []),
          userMsg,
          assistantMsg,
        ],
      },
      isStreaming: true,
      agentActivity: {
        phase: "thinking",
        description: "Thinking...",
        toolCalls: [],
      },
      pendingImageId: null,
      pendingImagePreview: null,
    }));

    // Collect generated content during streaming
    const collectedContent: GeneratedContent[] = [];
    const currentImageId = pendingImageId;

    let stream: EventSource | null = null;

    stream = createChatStream(
      activeSessionId,
      content,
      currentImageId ?? undefined,
      (event: SSEEvent) => {
        switch (event.type) {
          // ── Token — append to message ──────────────────────────────────────
          case "token":
            set((s) => ({
              messages: {
                ...s.messages,
                [activeSessionId]: s.messages[activeSessionId].map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + event.content }
                    : m
                ),
              },
            }));
            break;

          // ── Phase change ──────────────────────────────────────────────────
          case "phase":
            set((s) => ({
              agentActivity: s.agentActivity
                ? {
                    ...s.agentActivity,
                    phase: event.phase,
                    description: event.description,
                  }
                : {
                    phase: event.phase,
                    description: event.description,
                    toolCalls: [],
                  },
            }));
            break;

          // ── Tool call ─────────────────────────────────────────────────────
          case "tool_call":
            set((s) => ({
              agentActivity: s.agentActivity
                ? {
                    ...s.agentActivity,
                    toolCalls: [
                      ...s.agentActivity.toolCalls,
                      { tool: event.tool, args: event.args },
                    ],
                  }
                : null,
            }));
            break;

          // ── Tool result ───────────────────────────────────────────────────
          case "tool_result":
            set((s) => ({
              agentActivity: s.agentActivity
                ? {
                    ...s.agentActivity,
                    toolCalls: s.agentActivity.toolCalls.map((tc) =>
                      tc.tool === event.tool
                        ? { ...tc, success: event.success }
                        : tc
                    ),
                  }
                : null,
            }));
            break;

          // ── Generated content ─────────────────────────────────────────────
          case "content":
            collectedContent.push({
              type: event.content_type as ContentType,
              content: event.content,
              platform: event.platform as Platform | undefined,
            });
            // Attach content to assistant message
            set((s) => ({
              messages: {
                ...s.messages,
                [activeSessionId]: s.messages[activeSessionId].map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        generatedContent: [
                          ...(m.generatedContent || []),
                          {
                            type: event.content_type as ContentType,
                            content: event.content,
                            platform: event.platform as Platform | undefined,
                          },
                        ],
                      }
                    : m
                ),
              },
            }));
            break;

          // ── Done ──────────────────────────────────────────────────────────
          case "done":
            stream?.close();
            set((s) => ({
              isStreaming: false,
              agentActivity: null,
              messages: {
                ...s.messages,
                [activeSessionId]: s.messages[activeSessionId].map((m) =>
                  m.id === assistantMsgId ? { ...m, isStreaming: false } : m
                ),
              },
              // Update session message count in sidebar
              sessions: s.sessions.map((sess) =>
                sess.session_id === activeSessionId
                  ? { ...sess, message_count: sess.message_count + 2 }
                  : sess
              ),
            }));
            break;

          // ── Error ─────────────────────────────────────────────────────────
          case "error":
            stream?.close();
            set((s) => ({
              isStreaming: false,
              agentActivity: null,
              messages: {
                ...s.messages,
                [activeSessionId]: s.messages[activeSessionId].map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: `⚠️ Error: ${event.message}`,
                        isStreaming: false,
                      }
                    : m
                ),
              },
            }));
            break;
        }
      },
      (error: Error) => {
        stream?.close();
        set((s) => ({
          isStreaming: false,
          agentActivity: null,
          messages: {
            ...s.messages,
            [activeSessionId]: s.messages[activeSessionId].map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content:
                      m.content ||
                      `Error: ${error.message} Please verify the backend stream endpoint and try again.`,
                    isStreaming: false,
                  }
                : m
            ),
          },
        }));
      }
    );

    // The stream closes itself on "done" and "error" events.
    void stream;
  },

  setMessages: (sessionId, messages) => {
    set((s) => ({ messages: { ...s.messages, [sessionId]: messages } }));
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
