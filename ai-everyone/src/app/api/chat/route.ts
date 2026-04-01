/**
 * POST /api/chat
 *
 * Authenticated streaming chat route for SnitchX.
 *
 * - Verifies the Firebase ID token from the Authorization header
 * - Streams normal Ollama text responses incrementally
 * - Buffers agent-intent responses and converts them into agent tasks
 * - Preserves the existing persona + memory pipeline
 */

import { NextRequest, NextResponse } from "next/server";
import { createAgentTask, executeAgentTask } from "@/lib/firestore-tasks.server";
import { isTriggerMessage, isPersonalContextQuery } from "@/lib/memory/trigger-detector";
import { extractMemories } from "@/lib/memory/extractor";
import { processExtractedMemories } from "@/lib/memory/deduper";
import { rebuildPersona, formatPersonaForPrompt } from "@/lib/memory/persona-builder";
import { getPersona } from "@/lib/memory/memory-repository.server";
import { getTopKMemories, formatMemoriesForPrompt } from "@/lib/memory/retrieval";
import {
    AGENT_CATALOG,
    getAgentCatalogEntry,
    getInstallHintForAgent,
    getInstalledAgentRegistry,
} from "@/lib/agents/catalog";
import {
    getAccessibleAgentIds,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import { verifyFirebaseRequest } from "@/lib/server-auth";

const GOOGLE_AGENT_TYPES = new Set(["calendar", "gmail", "meet", "drive", "tasks", "web_search"]);

interface ChatRequestMessage {
    role: string;
    content: string;
}

interface AgentIntent {
    agent_required: string;
    action: string;
    parameters: Record<string, unknown>;
    reasoning?: string;
}

interface ParsedIntentResult {
    intent: AgentIntent;
    conversationalText: string;
}

function buildOrchestrationPrompt(
    installedAgentIds: string[],
    accessibleAgentIds: string[]
): string {
    const installedRegistry = getInstalledAgentRegistry(accessibleAgentIds);
    const installedSet = new Set(installedAgentIds);
    const accessibleSet = new Set(accessibleAgentIds);

    const availableAgentDescriptions = installedRegistry
        .map(
            (agent) =>
                `- **${agent.name}** (id: "${agent.id}")\n` +
                `  Description: ${agent.description}\n` +
                `  Actions: ${agent.actions.join(", ")}\n` +
                `  Example prompts: ${agent.examplePrompts.map((prompt) => `"${prompt}"`).join(", ")}`
        )
        .join("\n\n");

    const unavailableDescriptions = AGENT_CATALOG
        .filter((agent) => !accessibleSet.has(agent.id))
        .map((agent) => {
            const reason = installedSet.has(agent.id)
                ? `Installed but not connected. ${getInstallHintForAgent(agent.id)}`
                : getInstallHintForAgent(agent.id);
            return `- ${agent.name} (${agent.id}): ${reason}`;
        })
        .join("\n");

    return `You are the orchestration AI of SnitchX, an AI assistant platform.

You can either answer questions directly OR delegate tasks to specialized agents.

## Currently Available Agents
${availableAgentDescriptions || "No agents are currently available for this user."}

## Unavailable Agents
${unavailableDescriptions || "All registered agents are available right now."}

## Core Rules
1. If a request should be delegated to an AVAILABLE agent, respond with ONLY a valid JSON object wrapped inside <AGENT_INTENT> tags. Do not include any explanation before or after the tags.
2. If a request needs an UNAVAILABLE agent, do NOT emit <AGENT_INTENT>. Respond normally and tell the user to install or connect the required agent first.
3. NEVER execute actions yourself. Only delegate using <AGENT_INTENT> for available agents.
4. If you are unsure which agent is needed, ask a concise clarification question instead of emitting <AGENT_INTENT>.
5. The JSON inside <AGENT_INTENT> must be valid and parseable: no comments, no trailing commas.

## Agent Formatting Rules
For the teams-agent:
- make_call: extract "contact"
- send_message: extract "contact" and "message"
- schedule_meeting: extract "title", "attendees", "date", "time", "duration", "description", and "notification_preference"
- If notification preference is missing for a meeting request, do NOT emit <AGENT_INTENT>. Ask: "Would you like to be notified via WhatsApp, SMS, Call, All, or None?"

For the todo-agent:
- add_task: extract "title" and optional "datetime" in YYYY-MM-DD HH:MM
- add_to_plan: extract "title", optional "date", optional "time", optional "description", and optional "priority"
- list_tasks: optional "status"
- list_tasks_by_date: required "datetime" in YYYY-MM-DD
- get_daily_plan: extract "date" in YYYY-MM-DD when the user asks for a day's plan
- get_weekly_overview: extract optional "startDate" in YYYY-MM-DD
- delete_task and mark_done: use "task_id" if known, otherwise "title"
- Use the todo-agent for reminders, daily planning, and "remind me" requests unless the user explicitly asks for Google Tasks.

For the google-agent:
- Return this exact JSON shape:
  {
    "agent_required": "google-agent",
    "action": "<brief action label>",
    "parameters": {
      "agent_type": "<calendar|gmail|meet|drive|tasks|web_search>",
      "parameters": "<plain text details>"
    },
    "reasoning": "<brief explanation>"
  }
- For Gmail or Drive listing requests, NEVER request or return more than 20 items at once.
- Use "gmail" when the request is about Gmail inbox, reading emails, searching emails, or summarizing emails.
- Use "drive" when the request is about files, Google Docs, Drive documents, reading docs, or summarizing docs.
- Use "calendar" for calendar events, scheduling, and agendas.
- Use "meet" for Google Meet calls or links.
- Use "tasks" for Google Tasks or reminders.
- Use "web_search" for internet lookups.

For the maps-agent:
- get_directions: extract "origin", "destination", and optional "mode"
- search_places: extract "query", optional "location", and optional "radius"
- geocode: extract either "address" or "latlng"
- distance_matrix: extract "origins", "destinations", and optional "mode"

For the notion-agent:
- search_pages: extract "query" and optional "limit"
- get_page: extract "pageId" when known, otherwise use "query"
- create_page: extract "title", "content", and optional "parentPageId"
- append_to_page: extract "pageId" when known, otherwise use "query" plus "content"

For the canva-agent:
- list_designs: extract optional "limit" (number of designs to show)
- create_design: extract "title" and optional "type" (e.g. "presentation", "social_media")

For the day-planner-agent:
- get_daily_plan: extract "date" in YYYY-MM-DD (default: today)
- add_to_plan: extract "title", optional "date" in YYYY-MM-DD, optional "time" (HH:MM), optional "description", optional "priority" (high/medium/low), optional "duration" in minutes
- get_weekly_overview: extract optional "startDate" in YYYY-MM-DD (default: this Monday)
- NOTE: day-planner-agent is different from todo-agent — use day-planner-agent when user asks to "plan my day" or "add to my daily planner"

For the discord-agent:
- get_user_info: no parameters needed
- list_guilds: no parameters needed

For the dropbox-agent:
- search_files: extract "query" (search term) and optional "limit"
- create_folder: extract "path" (e.g. "/NewFolder")
- move_file: extract "from_path" and "to_path"

For the freshdesk-agent:
- create_ticket: extract "subject", "description", optional "status" (2=Open default), optional "priority" (1=Low default)
- check_ticket_status: extract "ticket_id" (number)
- search_solutions: extract "keyword"
- list_tickets: extract optional "limit" (default 5)

For the github-agent:
- list_repositories: extract optional "limit" and optional "sort" (updated/created/pushed)
- search_repositories: extract "query"
- get_issue: extract "owner", "repo", and "issueNumber"
- create_issue: extract "owner", "repo", "title", and optional "body"
- If owner or repo are missing and user hasn't specified, ask: "Which repository? (format: owner/repo)"

For the gitlab-agent:
- list_projects: extract optional "limit" and optional "search" filter
- get_issue: extract "projectId" (e.g. "mygroup/myproject") and "issueIid" (internal issue number)
- create_issue: extract "projectId", "title", and optional "description"

For the greenhouse-agent:
- list_candidates: extract optional "job_id" and optional "candidate_status" (active/rejected/hired)
- get_candidate_resume: extract "candidate_id"
- schedule_interview: extract "candidate_id", "interviewer_email", "start_time" (ISO 8601), "end_time" (ISO 8601)

For the jira-agent:
- create_issue: extract "project_key", "summary", "description", optional "issue_type" (Bug/Task/Story)
- get_issue_status: extract "issue_key" (e.g. "PROJ-123")
- search_issues: extract "jql" (Jira Query Language string)
- list_issues: extract optional "limit" (default 5)

For the linkedin-agent:
- schedule_post: extract "content" (the post text) and optional "scheduled_time" (ISO datetime)
- analyze_engagement: no parameters needed
- If user asks to "post on LinkedIn", use schedule_post without scheduled_time for an immediate post

For the zoom-agent:
- create_meeting: extract "topic", optional "start_time" (UTC ISO format), optional "duration" (minutes)
- list_upcoming_meetings: extract optional "type" (scheduled/upcoming, default upcoming)
- get_meeting_summary: extract "meetingId"

If an agent is needed, output ONLY:
<AGENT_INTENT>
{
  "agent_required": "<agent-id>",
  "action": "<action-name>",
  "parameters": {
    "key": "value"
  },
  "reasoning": "<brief explanation>"
}
</AGENT_INTENT>`;
}

function normalizeAgentIntent(parsed: Record<string, unknown>): AgentIntent | null {
    const action = typeof parsed.action === "string" ? parsed.action.trim() : "";
    if (!action) return null;

    const intent: AgentIntent = {
        agent_required: String(parsed.agent_required || "").trim(),
        action,
        parameters: {},
        reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : undefined,
    };

    if (typeof parsed.parameters === "string") {
        intent.parameters = { parameters: parsed.parameters };
    } else if (typeof parsed.parameters === "object" && parsed.parameters !== null) {
        intent.parameters = { ...(parsed.parameters as Record<string, unknown>) };
    } else if (typeof parsed.parameters !== "undefined" && parsed.parameters !== null) {
        intent.parameters = { parameters: String(parsed.parameters) };
    }

    if (typeof parsed.agent_type === "string" && !intent.parameters.agent_type) {
        intent.parameters.agent_type = parsed.agent_type;
    }

    return intent;
}

function fuzzyMatchAgent(rawAgent: string) {
    return AGENT_CATALOG.find((agent) => {
        const id = agent.id.toLowerCase();
        const name = agent.name.toLowerCase();
        return (
            rawAgent === id ||
            rawAgent === id.replace("-", "_") ||
            rawAgent.includes(id.replace("-", "")) ||
            name.includes(rawAgent)
        );
    });
}

function normalizeGoogleIntent(intent: AgentIntent): AgentIntent {
    if (intent.agent_required !== "google-agent") return intent;

    const normalized: AgentIntent = {
        ...intent,
        parameters: { ...intent.parameters },
    };

    const currentAgentType =
        typeof normalized.parameters.agent_type === "string"
            ? normalized.parameters.agent_type.toLowerCase().trim()
            : "";

    if (GOOGLE_AGENT_TYPES.has(currentAgentType)) {
        normalized.parameters.agent_type = currentAgentType;
        return normalized;
    }

    const actionLower = normalized.action.toLowerCase().trim();
    if (GOOGLE_AGENT_TYPES.has(actionLower)) {
        normalized.parameters.agent_type = actionLower;
        return normalized;
    }

    const paramsText = String(normalized.parameters.parameters || "").toLowerCase();
    if (/\b(gmail|email|mail|inbox)\b/.test(paramsText)) normalized.parameters.agent_type = "gmail";
    else if (/\b(drive|file|files|docs?|documents?)\b/.test(paramsText)) normalized.parameters.agent_type = "drive";
    else if (/\b(calendar|event|schedule|agenda)\b/.test(paramsText)) normalized.parameters.agent_type = "calendar";
    else if (/\b(meet|meeting|video call)\b/.test(paramsText)) normalized.parameters.agent_type = "meet";
    else if (/\b(task|tasks|todo|to-do|remind)\b/.test(paramsText)) normalized.parameters.agent_type = "tasks";
    else if (/\b(search|web|internet|lookup|look up)\b/.test(paramsText)) normalized.parameters.agent_type = "web_search";

    return normalized;
}

function tryParseAgentIntent(content: string): ParsedIntentResult | { error: true; fallback: string } | null {
    const tagMatch = content.match(/<AGENT_INTENT>([\s\S]*?)<\/AGENT_INTENT>/);

    if (!tagMatch) {
        return null;
    }

    const jsonStr = tagMatch[1].trim();
    const conversationalText = content.replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/, "").trim();

    try {
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed !== "object" || parsed === null) {
            return { error: true, fallback: "I could not understand that agent request. Please try again." };
        }

        const normalizedIntent = normalizeAgentIntent(parsed as Record<string, unknown>);
        if (!normalizedIntent) {
            return { error: true, fallback: "I could not understand that agent request. Please try again." };
        }

        const matchedAgent = fuzzyMatchAgent(String(normalizedIntent.agent_required || "").toLowerCase());
        if (!matchedAgent) {
            return { error: true, fallback: "I could not match that request to a supported agent." };
        }

        normalizedIntent.agent_required = matchedAgent.id;
        const finalIntent = normalizeGoogleIntent(normalizedIntent);

        if (
            finalIntent.agent_required === "google-agent" &&
            (typeof finalIntent.parameters.agent_type !== "string" ||
                !GOOGLE_AGENT_TYPES.has(finalIntent.parameters.agent_type.toLowerCase().trim()))
        ) {
            return {
                error: true,
                fallback:
                    "I could not determine which Google service to use. Please mention Gmail, Drive, Calendar, Meet, Tasks, or Web Search.",
            };
        }

        return { intent: finalIntent, conversationalText };
    } catch {
        return { error: true, fallback: "I generated an invalid agent payload. Please try again." };
    }
}

function getNumericRequestCount(text: string): number | null {
    const lower = text.toLowerCase();

    if (/\b(all|every)\s+(emails?|mails?|files?|documents?|docs?)\b/.test(lower)) {
        return 999;
    }

    const directMatch = lower.match(/\b(\d{1,4})\s+(latest\s+|recent\s+|last\s+)?(emails?|mails?|files?|documents?|docs?)\b/);
    if (directMatch) {
        return Number.parseInt(directMatch[1], 10);
    }

    return null;
}

function getGoogleIntentLimitViolation(intent: AgentIntent, userMessage: string): string | null {
    if (intent.agent_required !== "google-agent") return null;

    const rawAgentType = intent.parameters.agent_type;
    const agentType = typeof rawAgentType === "string" ? rawAgentType.toLowerCase() : "";
    if (agentType !== "gmail" && agentType !== "drive") return null;

    const requestedCount = getNumericRequestCount(userMessage) ?? getNumericRequestCount(String(intent.parameters.parameters || ""));
    if (requestedCount && requestedCount > 20) {
        const itemLabel = agentType === "gmail" ? "emails" : "files";
        return `I currently cannot display more than 20 ${itemLabel} at once. Please ask for 20 or fewer.`;
    }

    return null;
}

function triggerMemoryExtraction(
    uid: string,
    chatId: string | undefined,
    messageId: string | undefined,
    content: string
): void {
    Promise.resolve()
        .then(async () => {
            try {
                if (!isTriggerMessage(content)) {
                    return;
                }

                const extracted = await extractMemories(content);
                if (extracted.length === 0) {
                    return;
                }

                const saved = await processExtractedMemories(
                    uid,
                    extracted,
                    "chat",
                    chatId ?? null,
                    messageId ?? null
                );

                if (saved > 0) {
                    rebuildPersona(uid).catch((err) =>
                        console.error("[MemoryPipeline] persona rebuild error:", err)
                    );
                }
            } catch (err) {
                console.error("[MemoryPipeline] error:", err);
            }
        })
        .catch((err) => console.error("[MemoryPipeline] unhandled:", err));
}

async function buildPersonaContext(uid: string, userMessage: string): Promise<string> {
    if (!isPersonalContextQuery(userMessage)) return "";

    try {
        const [persona, topMemories] = await Promise.all([
            getPersona(uid),
            getTopKMemories(uid, userMessage, 7),
        ]);

        const personaSection = formatPersonaForPrompt(persona);
        const memoriesSection = formatMemoriesForPrompt(topMemories);
        return [personaSection, memoriesSection].filter(Boolean).join("\n\n");
    } catch (err) {
        console.error("[PersonaContext] failed:", err);
        return "";
    }
}

async function streamOllamaChat(
    baseUrl: string,
    model: string,
    messages: { role: string; content: string }[],
    onDelta: (delta: string) => void
): Promise<string> {
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model,
            messages,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `Ollama returned status ${response.status}. ${errorText || "No details available."}`
        );
    }

    if (!response.body) {
        throw new Error("Ollama did not return a streaming body.");
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

            const payload = JSON.parse(trimmed) as {
                done?: boolean;
                message?: { content?: string };
            };

            const delta = payload.message?.content || "";
            if (delta) {
                fullContent += delta;
                onDelta(delta);
            }
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

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { messages, chatId } = body as {
            messages: ChatRequestMessage[];
            chatId?: string;
            model?: string;
        };

        if (!Array.isArray(messages) || messages.length === 0) {
            return NextResponse.json(
                { error: "Request body must include a non-empty messages array." },
                { status: 400 }
            );
        }

        const uid = verifiedUser.uid;
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
        const model = body.model || process.env.OLLAMA_DEFAULT_MODEL || "qwen3.5:397b-cloud";

        const lastUserMessage =
            [...messages].reverse().find((message) => message.role === "user")?.content || "";

        const [installedAgentIds, accessibleAgentIds, personaContext] = await Promise.all([
            getInstalledAgentIds(uid),
            getAccessibleAgentIds(uid),
            buildPersonaContext(uid, lastUserMessage),
        ]);

        if (lastUserMessage) {
            triggerMemoryExtraction(uid, chatId, undefined, lastUserMessage);
        }

        const systemPrompt = [
            buildOrchestrationPrompt(installedAgentIds, accessibleAgentIds),
            personaContext,
        ]
            .filter(Boolean)
            .join("\n\n");

        const messagesForOllama = [
            { role: "system", content: systemPrompt },
            ...messages.map((message) => ({
                role: message.role === "agent" ? "assistant" : message.role,
                content: message.content,
            })),
        ];

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            start(controller) {
                const sendEvent = (event: string, data: Record<string, unknown>) => {
                    controller.enqueue(
                        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
                    );
                };

                const run = async () => {
                    try {
                        let streamedText = "";
                        let rawAssistantContent = "";
                        let heldBuffer = "";
                        let streamMode: "undecided" | "text" | "intent" = "undecided";

                        const handleDelta = (delta: string) => {
                            rawAssistantContent += delta;
                            heldBuffer += delta;

                            if (streamMode === "undecided") {
                                const trimmed = heldBuffer.trimStart();
                                if (!trimmed) return;

                                if (
                                    trimmed.startsWith("<AGENT_INTENT>") ||
                                    "<AGENT_INTENT>".startsWith(trimmed)
                                ) {
                                    streamMode = "intent";
                                    return;
                                }

                                if (trimmed.startsWith("<") && heldBuffer.length < 24) {
                                    return;
                                }

                                streamMode = "text";
                                streamedText += heldBuffer;
                                sendEvent("text", { content: heldBuffer });
                                heldBuffer = "";
                                return;
                            }

                            if (streamMode === "text") {
                                streamedText += delta;
                                sendEvent("text", { content: delta });
                            }
                        };

                        const assistantContent = await streamOllamaChat(
                            baseUrl,
                            model,
                            messagesForOllama,
                            handleDelta
                        );

                        const parseResult = tryParseAgentIntent(assistantContent);
                        if (parseResult && "error" in parseResult) {
                            const fallback = parseResult.fallback;
                            if (!streamedText.trim()) {
                                sendEvent("text", { content: fallback });
                            }
                            sendEvent("done", { type: "chat", content: fallback });
                            controller.close();
                            return;
                        }

                        if (parseResult && chatId) {
                            const { intent } = parseResult;
                            const googleLimitMessage = getGoogleIntentLimitViolation(intent, lastUserMessage);
                            if (googleLimitMessage) {
                                if (!streamedText.trim()) {
                                    sendEvent("text", { content: googleLimitMessage });
                                }
                                sendEvent("done", { type: "chat", content: googleLimitMessage });
                                controller.close();
                                return;
                            }

                            if (!installedAgentIds.includes(intent.agent_required)) {
                                const installMessage = getInstallHintForAgent(intent.agent_required);
                                if (!streamedText.trim()) {
                                    sendEvent("text", { content: installMessage });
                                }
                                sendEvent("done", { type: "chat", content: installMessage });
                                controller.close();
                                return;
                            }

                            if (!accessibleAgentIds.includes(intent.agent_required)) {
                                const connectMessage = getInstallHintForAgent(intent.agent_required);
                                if (!streamedText.trim()) {
                                    sendEvent("text", { content: connectMessage });
                                }
                                sendEvent("done", { type: "chat", content: connectMessage });
                                controller.close();
                                return;
                            }

                            const task = await createAgentTask({
                                userId: uid,
                                chatId,
                                agentId: intent.agent_required,
                                parentLLMRequest: intent as unknown as Record<string, unknown>,
                                agentInput: {
                                    action: intent.action,
                                    ...intent.parameters,
                                },
                            });

                            executeAgentTask(task).catch((err) =>
                                console.error("[executeAgentTask] background error:", err)
                            );

                            const agentName =
                                getAgentCatalogEntry(intent.agent_required)?.name || intent.agent_required;
                            const content =
                                `Delegating to ${agentName}.\n\n` +
                                `Action: ${intent.action}` +
                                (intent.reasoning ? `\n\nReasoning: ${intent.reasoning}` : "");

                            sendEvent("agent_task", {
                                type: "agent_task",
                                taskId: task.taskId,
                                agentId: intent.agent_required,
                                status: "queued",
                                content,
                            });
                            sendEvent("done", {
                                type: "agent_task",
                                taskId: task.taskId,
                                agentId: intent.agent_required,
                                status: "queued",
                                content,
                            });
                            controller.close();
                            return;
                        }

                        const cleanContent = assistantContent
                            .replace(/<AGENT_INTENT>[\s\S]*?<\/AGENT_INTENT>/g, "")
                            .trim();

                        if (!streamedText.trim() && cleanContent) {
                            sendEvent("text", { content: cleanContent });
                        }

                        sendEvent("done", {
                            type: "chat",
                            content: cleanContent || streamedText || "No response received.",
                        });
                        controller.close();
                    } catch (error) {
                        console.error("[Chat API Error]", error);
                        const message =
                            error instanceof Error ? error.message : "Internal server error";
                        sendEvent("error", { error: message });
                        controller.close();
                    }
                };

                void run();
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache, no-transform",
                Connection: "keep-alive",
                "X-Accel-Buffering": "no",
            },
        });
    } catch (error) {
        console.error("[Chat API Error]", error);
        const message =
            error instanceof Error ? error.message : "Unknown error occurred";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
