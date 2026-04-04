/**
 * Chat system type definitions.
 * Adapted from Chatbot-UI's types/chat.ts and types/chat-message.ts,
 * simplified for a single-model (Ollama/Qwen-3) setup with Firebase.
 *
 * Extended to support agent tasks in the agentic pipeline.
 */

/** A single chat conversation belonging to a user. */
export interface Chat {
    id: string;
    userId: string;
    title: string;
    createdAt: string; // ISO 8601 timestamp
    updatedAt: string; // ISO 8601 timestamp
}

/** The role of a message sender. */
export type MessageRole = "user" | "assistant" | "agent";

export type ChatAttachmentSource = "computer" | "drive";

export interface ChatAttachment {
    id: string;
    source: ChatAttachmentSource;
    name: string;
    mimeType: string;
    size?: number;
    dataBase64?: string;
    driveFileId?: string;
    webViewLink?: string;
    storagePath?: string;
}

export interface ChatFailedAttachment {
    name: string;
    reason: string;
}

/** A single message within a chat conversation. */
export interface ChatMessage {
    id: string;
    chatId: string;
    role: MessageRole;
    content: string;
    createdAt: string; // ISO 8601 timestamp
    /** If role === "agent", links to an agentTask document for status tracking. */
    taskId?: string;
    /** If role === "agent", which agent executed this task. */
    agentId?: string;
    /** If true, this message was part of a Voice Session. */
    isVoice?: boolean;
    /** Files user attached with this prompt (metadata only). */
    attachments?: ChatAttachment[];
    /** Optional UI metadata for rich assistant cards. */
    meta?: Record<string, unknown>;
}

/** Payload sent from the frontend to the /api/chat route. */
export interface ChatRequestPayload {
    messages: { role: MessageRole; content: string; isVoice?: boolean }[];
    chatId?: string;
    userId?: string;
    model?: string;
    attachments?: ChatAttachment[];
    failedAttachments?: ChatFailedAttachment[];
}

/** Response returned by the /api/chat route (normal chat). */
export interface ChatResponseChat {
    type: "chat";
    content: string;
}

/** Response returned by the /api/chat route (agent task created). */
export interface ChatResponseAgentTask {
    type: "agent_task";
    taskId: string;
    agentId: string;
    status: string;
    content: string; // User-facing message about the task
}

/** Union of possible response types from the /api/chat route. */
export type ChatResponsePayload = ChatResponseChat | ChatResponseAgentTask;

/**
 * Agent registry entry — describes an agent the parent LLM can invoke.
 * Used to build the orchestration system prompt.
 */
export interface AgentRegistryEntry {
    id: string;
    name: string;
    description: string;
    actions: string[];
    examplePrompts: string[];
}
