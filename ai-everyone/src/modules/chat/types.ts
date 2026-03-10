/**
 * Chat system type definitions.
 * Adapted from Chatbot-UI's types/chat.ts and types/chat-message.ts,
 * simplified for a single-model (Ollama/Qwen-3) setup with Firebase.
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
export type MessageRole = "user" | "assistant";

/** A single message within a chat conversation. */
export interface ChatMessage {
    id: string;
    chatId: string;
    role: MessageRole;
    content: string;
    createdAt: string; // ISO 8601 timestamp
}

/** Payload sent from the frontend to the /api/chat route. */
export interface ChatRequestPayload {
    messages: { role: MessageRole; content: string }[];
}

/** Response returned by the /api/chat route. */
export interface ChatResponsePayload {
    content: string;
}
