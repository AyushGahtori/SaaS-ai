/**
 * POST /api/chat
 *
 * Next.js API route — orchestrates the parent LLM (Ollama).
 *
 * Two modes:
 *  1. Normal chat — Ollama returns plain text → forwarded to frontend.
 *  2. Agent intent — Ollama returns JSON wrapped in <AGENT_INTENT> tags
 *     → creates an agentTask in Firestore → returns task metadata to frontend.
 *
 * Uses TAG-BASED extraction: the LLM wraps structured data in
 * <AGENT_INTENT>...</AGENT_INTENT> tags, allowing conversational text
 * alongside the intent JSON. This is more robust than raw JSON parsing.
 *
 * Request body:  { messages, chatId?, userId?, model? }
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
            "Handles Microsoft Teams actions: making voice/video calls, sending messages, " +
            "and scheduling meetings with attendees. Can search contacts by name and resolve " +
            "their email addresses via Microsoft Graph.",
        actions: ["make_call", "send_message", "schedule_meeting"],
        examplePrompts: [
            "Call Nandini on Teams",
            "Send a message to Riya on Teams saying I will be late",
            "Make a Teams call to john@company.com",
            "Schedule a meeting with Aaron and Priya tomorrow at 10 AM about the sprint",
            "Set up a 30-minute standup with the team on Monday at 9 AM",
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
1. If the user's request matches an agent's capabilities, you MUST wrap a valid JSON object inside <AGENT_INTENT> tags. You may include a brief, friendly explanation BEFORE the tags. Example:

Sure! I'll call Aaron on Microsoft Teams for you right away.

<AGENT_INTENT>
{
  "agent_required": "<agent-id>",
  "action": "<action-name>",
  "parameters": {
    <relevant parameters extracted from the user's message>
  },
  "reasoning": "<brief explanation of why you chose this agent>"
}
</AGENT_INTENT>

2. For the teams-agent:
   - For "make_call" action: extract "contact" parameter (person name or email)
   - For "send_message" action: extract "contact" and "message" parameters
   - For "schedule_meeting" action: extract these parameters:
     - "title": meeting title (required)
     - "attendees": array of names or emails (required)
     - "date": date as YYYY-MM-DD (required, calculate from relative dates like "tomorrow" or "next Monday")
     - "time": time as HH:MM in 24-hour format (required)
     - "duration": duration in minutes (default to 30 if not specified)
     - "description": agenda or description (optional)

3. If the user's request does NOT match any agent, respond normally as a helpful AI assistant. Do NOT use <AGENT_INTENT> tags in this case.

4. NEVER execute actions directly. ALWAYS delegate to the appropriate agent via the <AGENT_INTENT> tags.

5. If you are unsure whether an agent is needed, respond normally and ask the user for clarification.

6. The JSON inside <AGENT_INTENT> must be valid and parseable — no trailing commas, no comments.`;
}

// ---------------------------------------------------------------------------
// Intent Detection — Tag-Based extraction with <AGENT_INTENT> tags
// ---------------------------------------------------------------------------

interface AgentIntent {
    agent_required: string;
    action: string;
    parameters: Record<string, unknown>;
    reasoning?: string;
}

interface ParsedIntentResult {
    intent: AgentIntent;
    /** Conversational text the LLM wrote OUTSIDE the tags */
    conversationalText: string;
}

function tryParseAgentIntent(content: string): ParsedIntentResult | { error: true; fallback: string } | null {
    // ── 1. Try tag-based extraction (primary method) ──────────────────
    const tagMatch = content.match(/<AGENT_INTENT>([\s\S]*?)<\/AGENT_INTENT>/);

    if (tagMatch) {
        const jsonStr = tagMatch[1].trim();
        const conversationalText = content
            .replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/, "")
            .trim();

        try {
            const parsed = JSON.parse(jsonStr);

            if (
                typeof parsed === "object" &&
                parsed !== null &&
                typeof parsed.action === "string" &&
                typeof parsed.parameters === "object"
            ) {
                const rawAgent = String(parsed.agent_required || "").toLowerCase();

                // Fuzzy match the agent in the registry
                const matchedAgent = fuzzyMatchAgent(rawAgent);

                if (matchedAgent) {
                    parsed.agent_required = matchedAgent.id;
                    return { intent: parsed as AgentIntent, conversationalText };
                } else {
                    return { error: true, fallback: "The AI attempted to trigger an agent but provided an unrecognized agent ID." };
                }
            }
        } catch {
            return { error: true, fallback: "The AI attempted to trigger an agent but the JSON inside <AGENT_INTENT> tags was invalid." };
        }
    }

    // ── 2. Fallback: try raw JSON parsing (backwards compatibility) ───
    const trimmed = content.trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    const looksLikeAgentJson = trimmed.startsWith("{") && trimmed.includes('"agent_required"');

    if (looksLikeAgentJson) {
        try {
            const parsed = JSON.parse(trimmed);
            if (
                typeof parsed === "object" &&
                parsed !== null &&
                typeof parsed.action === "string" &&
                typeof parsed.parameters === "object"
            ) {
                const rawAgent = String(parsed.agent_required || "").toLowerCase();
                const matchedAgent = fuzzyMatchAgent(rawAgent);

                if (matchedAgent) {
                    parsed.agent_required = matchedAgent.id;
                    return { intent: parsed as AgentIntent, conversationalText: "" };
                } else {
                    return { error: true, fallback: "The AI attempted to trigger an agent but provided an unrecognized agent ID." };
                }
            }
        } catch {
            return { error: true, fallback: "The AI attempted to trigger an agent but generated invalid JSON format." };
        }
    }

    return null;
}

/** Fuzzy-match an agent ID string against the registry */
function fuzzyMatchAgent(rawAgent: string) {
    return AGENT_REGISTRY.find((a) => {
        const id = a.id.toLowerCase();
        const name = a.name.toLowerCase();
        return (
            rawAgent === id ||
            rawAgent === id.replace("-", "_") ||
            (rawAgent.includes("teams") && id.includes("teams")) ||
            rawAgent.includes(id.replace("-", "")) ||
            name.includes(rawAgent)
        );
    });
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

        // Read Ollama config — model can come from frontend or env.
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        const selectedModel = body.model || process.env.OLLAMA_DEFAULT_MODEL || "qwen3.5:397b-cloud";
        const model = selectedModel;

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

        // ── Check if the LLM returned an agent intent (tag-based) ──────
        const result = tryParseAgentIntent(assistantContent);

        if (result && 'error' in result) {
            // The LLM tried to output an agent intent but it's malformed.
            // Don't bleed raw JSON/tags to the user.
            return NextResponse.json({
                type: "chat",
                content: result.fallback,
            });
        }

        if (result && userId && chatId) {
            const { intent, conversationalText } = result;

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
            executeAgentTask(task).catch((err) =>
                console.error("[executeAgentTask] Background error:", err)
            );

            // Build a user-facing message — include the AI's conversational text
            const agentName =
                AGENT_REGISTRY.find((a) => a.id === intent.agent_required)?.name ||
                intent.agent_required;

            const taskSummary = `🤖 Delegating to **${agentName}**...\n\nAction: \`${intent.action}\`${intent.reasoning ? `\n\nReasoning: ${intent.reasoning}` : ""}`;
            const fullContent = conversationalText
                ? `${conversationalText}\n\n${taskSummary}`
                : taskSummary;

            return NextResponse.json({
                type: "agent_task",
                taskId: task.taskId,
                agentId: intent.agent_required,
                status: "queued",
                content: fullContent,
            });
        }

        // ── Normal chat response (strip any stray tags just in case) ─────
        const cleanContent = assistantContent
            .replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/g, "")
            .trim() || assistantContent;

        return NextResponse.json({
            type: "chat",
            content: cleanContent,
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
