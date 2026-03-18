/**
 * POST /api/chat
 *
 * Next.js API route — orchestrates the parent LLM (Ollama).
 *
 * Two modes:
 *  1. Normal chat — Ollama returns plain text → forwarded to frontend.
 *  2. Agent intent — Ollama returns structured JSON → creates an agentTask
 *     in Firestore → returns task metadata to frontend.
 *
 * The orchestration system prompt tells Ollama which agents are available
 * and instructs it to return JSON when an agent action is needed.
 *
 * Request body:  { messages, chatId?, userId? }
 * Response body: { type: "chat", content } | { type: "agent_task", taskId, agentId, status, content }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAgentTask, executeAgentTask } from "@/lib/firestore-tasks.server";
import type { AgentRegistryEntry } from "@/modules/chat/types";

// ---------------------------------------------------------------------------
// Agent Registry — describes all agents the parent LLM can choose from.
// This is the "brain" that tells the LLM what tools it has.
// ---------------------------------------------------------------------------

const AGENT_REGISTRY: AgentRegistryEntry[] = [
    {
        id: "teams-agent",
        name: "Microsoft Teams Agent",
        description:
            "Handles Microsoft Teams actions: making voice/video calls and sending messages to contacts. " +
            "Can search contacts by name and resolve their email addresses via Microsoft Graph.",
        actions: ["make_call", "send_message"],
        examplePrompts: [
            "Call Nandini on Teams",
            "Send a message to Riya on Teams saying I will be late",
            "Make a Teams call to john@company.com",
        ],
    },
    // Future agents can be added here:
    // {
    //     id: "email-agent",
    //     name: "Email Agent",
    //     description: "Compose and send professional emails via Gmail.",
    //     actions: ["send_email", "draft_email"],
    //     examplePrompts: ["Send an email to ACME Corp about the project delay"],
    // },
];

// ---------------------------------------------------------------------------
// Orchestration System Prompt
// ---------------------------------------------------------------------------

function buildOrchestrationPrompt(installedAgentIds?: string[]): string {
    // Filter to only installed agents if provided, otherwise show all
    const availableAgents = installedAgentIds
        ? AGENT_REGISTRY.filter((a) => installedAgentIds.includes(a.id))
        : AGENT_REGISTRY;

    const agentDescriptions = availableAgents
        .map(
            (a) =>
                `- **${a.name}** (id: "${a.id}")\n` +
                `  Description: ${a.description}\n` +
                `  Actions: ${a.actions.join(", ")}\n` +
                `  Example prompts: ${a.examplePrompts.map((p) => `"${p}"`).join(", ")}`
        )
        .join("\n\n");

    return `You are the orchestration AI of SnitchX, an AI assistant platform.

You can either answer questions directly OR delegate tasks to specialized agents.

## Available Agents:
${agentDescriptions || "No agents available."}

## Rules:
1. If the user's request matches an agent's capabilities, you MUST return ONLY a valid JSON object (no markdown, no explanation, no code fences) in this exact format:
{
  "agent_required": "<agent-id>",
  "action": "<action-name>",
  "parameters": {
    <relevant parameters extracted from the user's message>
  },
  "reasoning": "<brief explanation of why you chose this agent>"
}

2. For the teams-agent:
   - For "make_call" action: extract "contact" parameter (person name or email)
   - For "send_message" action: extract "contact" and "message" parameters

3. If the user's request does NOT match any agent, respond normally as a helpful AI assistant. Do NOT return JSON in this case.

4. NEVER execute actions directly. ALWAYS delegate to the appropriate agent via JSON.

5. If you are unsure whether an agent is needed, respond normally and ask the user for clarification.

6. Your JSON response must be parseable — no trailing commas, no comments, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Intent Detection — check if Ollama returned agent JSON
// ---------------------------------------------------------------------------

interface AgentIntent {
    agent_required: string;
    action: string;
    parameters: Record<string, unknown>;
    reasoning?: string;
}

function tryParseAgentIntent(content: string): AgentIntent | null {
    const trimmed = content.trim();

    // Strip markdown code fences if present (LLM sometimes adds them despite instructions)
    const cleaned = trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try {
        const parsed = JSON.parse(cleaned);

        // Validate it has the required agent intent fields
        if (
            typeof parsed === "object" &&
            parsed !== null &&
            typeof parsed.agent_required === "string" &&
            typeof parsed.action === "string" &&
            typeof parsed.parameters === "object"
        ) {
            // Verify the agent exists in our registry
            const agentExists = AGENT_REGISTRY.some(
                (a) => a.id === parsed.agent_required
            );
            if (!agentExists) return null;

            return parsed as AgentIntent;
        }
    } catch {
        // Not JSON — this is a normal chat response
    }
    return null;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { messages, chatId, userId } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Request body must include a non-empty `messages` array." },
                { status: 400 }
            );
        }

        // Read Ollama config from environment variables.
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const model = process.env.OLLAMA_MODEL || "qwen3";

        // Build the orchestration system prompt
        const systemPrompt = buildOrchestrationPrompt();

        // Prepend the system prompt to the message history
        const messagesForOllama = [
            { role: "system", content: systemPrompt },
            ...messages.map((m: { role: string; content: string }) => ({
                role: m.role === "agent" ? "assistant" : m.role, // Map "agent" role to "assistant" for Ollama
                content: m.content,
            })),
        ];

        // Call the Ollama /api/chat endpoint
        const ollamaRes = await fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model,
                messages: messagesForOllama,
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
        const assistantContent: string =
            ollamaData?.message?.content ?? "No response from model.";

        // ── Check if the LLM returned an agent intent ─────────────────────
        const intent = tryParseAgentIntent(assistantContent);

        if (intent && userId && chatId) {
            // Agent intent detected → create a task in Firestore
            console.log("[Agent Intent]", JSON.stringify(intent));

            const task = await createAgentTask({
                userId,
                chatId,
                agentId: intent.agent_required,
                parentLLMRequest: intent as unknown as Record<string, unknown>,
                agentInput: {
                    action: intent.action,
                    ...intent.parameters,
                },
            });

            // ── Fire-and-forget: execute the agent task in background ──
            // This bypasses the Cloud Function for local dev. The frontend
            // Firestore listener will pick up real-time status changes.
            executeAgentTask(task).catch((err) =>
                console.error("[executeAgentTask] Background error:", err)
            );

            // Build a user-facing message about the task
            const agentName =
                AGENT_REGISTRY.find((a) => a.id === intent.agent_required)?.name ||
                intent.agent_required;

            return NextResponse.json({
                type: "agent_task",
                taskId: task.taskId,
                agentId: intent.agent_required,
                status: "queued",
                content: `🤖 Delegating to **${agentName}**...\n\nAction: \`${intent.action}\`${intent.reasoning ? `\n\nReasoning: ${intent.reasoning}` : ""}`,
            });
        }

        // ── Normal chat response ──────────────────────────────────────────
        return NextResponse.json({
            type: "chat",
            content: assistantContent,
        });
    } catch (error: unknown) {
        console.error("[Chat API Error]", error);

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
