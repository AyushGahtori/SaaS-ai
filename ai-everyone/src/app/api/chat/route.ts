/**
 * POST /api/chat
 *
 * Next.js API route that proxies chat requests to the local Ollama server.
 * Replaces ALL provider-specific routes from Chatbot-UI with a single
 * Ollama/Qwen-3 endpoint.
 *
 * Request body:  { messages: [{ role, content }, ...] }
 * Response body: { content: "..." }
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Request body must include a non-empty `messages` array." },
                { status: 400 }
            );
        }

        // Read Ollama config from environment variables.
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const model = process.env.OLLAMA_MODEL || "qwen3";

        // Call the Ollama /api/chat endpoint (multi-turn conversation format).
        // Using stream: false to get the full response in one JSON payload.
        const ollamaRes = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: messages.map((m: { role: string; content: string }) => ({
                    role: m.role,
                    content: m.content,
                })),
                stream: false,
            }),
        });

        if (!ollamaRes.ok) {
            const errorText = await ollamaRes.text();
            console.error("[Ollama API Error]", ollamaRes.status, errorText);
            return NextResponse.json(
                {
                    error: `Ollama returned status ${ollamaRes.status}. Is Ollama running with the "${model}" model pulled?`,
                    details: errorText,
                },
                { status: 502 }
            );
        }

        const ollamaData = await ollamaRes.json();

        // Ollama /api/chat returns: { message: { role, content }, ... }
        const assistantContent =
            ollamaData?.message?.content ?? "No response from model.";

        return NextResponse.json({ content: assistantContent });
    } catch (error: unknown) {
        console.error("[Chat API Error]", error);

        // Check if it's a connection error (Ollama not running)
        const message =
            error instanceof Error ? error.message : "Unknown error occurred";
        const isConnectionError =
            message.includes("ECONNREFUSED") || message.includes("fetch failed");

        return NextResponse.json(
            {
                error: isConnectionError
                    ? "Cannot connect to Ollama. Make sure Ollama is running on localhost:11434."
                    : `Internal server error: ${message}`,
            },
            { status: isConnectionError ? 503 : 500 }
        );
    }
}
