import { NextRequest, NextResponse } from "next/server";
import { getInstallHintForAgent, getAgentCatalogEntry } from "@/lib/agents/catalog";
import {
    getAccessibleAgentIds,
    getInstalledAgentIds,
} from "@/lib/agents/user-access.server";
import { resolveAgentWorkspaceRequest } from "@/lib/agents/workspace-router";
import { renderWorkspaceCapabilitiesText } from "@/lib/agents/workspace-intake";
import { createAgentTask, executeAgentTaskAndReadBack } from "@/lib/firestore-tasks.server";
import { isGeminiModel } from "@/lib/model-capabilities";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import { commitUsageSlot, reserveUsageSlot } from "@/lib/usage-limit";

interface ChatRequestMessage {
    role: string;
    content: string;
    taskId?: string;
    agentId?: string;
    isVoice?: boolean;
}

interface AgentChatBody {
    messages?: ChatRequestMessage[];
    chatId?: string;
    model?: string;
    attachments?: Array<Record<string, unknown>>;
}

const DEFAULT_WORKSPACE_MODEL =
    process.env.GEMINI_MODEL_FLASH ||
    process.env.GEMINI_MODEL_FLASH_LITE ||
    "gemini-3-flash-preview";

function streamEvents(events: Array<{ event: string; data: Record<string, unknown> }>) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        start(controller) {
            for (const item of events) {
                controller.enqueue(
                    encoder.encode(`event: ${item.event}\ndata: ${JSON.stringify(item.data)}\n\n`)
                );
            }
            controller.close();
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
}

function streamChat(content: string, meta?: Record<string, unknown>) {
    return streamEvents([
        { event: "text", data: { content } },
        { event: "done", data: { type: "chat", content, ...(meta ? { meta } : {}) } },
    ]);
}

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ agentId: string }> }
) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { agentId: rawAgentId } = await context.params;
    const agentId = decodeURIComponent(rawAgentId || "");
    const agent = getAgentCatalogEntry(agentId);
    if (!agent) {
        return NextResponse.json({ error: "Unknown agent workspace." }, { status: 404 });
    }

    try {
        const body = (await req.json()) as AgentChatBody;
        const messages = Array.isArray(body.messages) ? body.messages : [];
        const chatId = body.chatId;
        const requestedModel = typeof body.model === "string" ? body.model.trim() : "";
        const workspaceModel = requestedModel || DEFAULT_WORKSPACE_MODEL;
        const lastUserMessage =
            [...messages].reverse().find((message) => message.role === "user")?.content || "";

        if (!chatId) {
            return NextResponse.json({ error: "chatId is required for agent workspace chat." }, { status: 400 });
        }

        if (!lastUserMessage.trim()) {
            return NextResponse.json(
                { error: "Request body must include a user message." },
                { status: 400 }
            );
        }

        const uid = verifiedUser.uid;
        await reserveUsageSlot(uid, verifiedUser.email);

        const [installedAgentIds, accessibleAgentIds] = await Promise.all([
            getInstalledAgentIds(uid),
            getAccessibleAgentIds(uid),
        ]);

        console.info("[AgentWorkspaceChat] request", {
            userId: uid,
            chatId,
            agentId,
            message: lastUserMessage.slice(0, 300),
        });

        if (!installedAgentIds.includes(agentId)) {
            await commitUsageSlot(uid, verifiedUser.email);
            return streamChat(getInstallHintForAgent(agentId), {
                status: "needs_clarification",
                selected_agent: agentId,
                validation: "not_installed",
            });
        }

        if (!accessibleAgentIds.includes(agentId)) {
            await commitUsageSlot(uid, verifiedUser.email);
            return streamChat(getInstallHintForAgent(agentId), {
                status: "needs_clarification",
                selected_agent: agentId,
                validation: "not_accessible",
            });
        }

        const resolution = await resolveAgentWorkspaceRequest({
            userId: uid,
            chatId,
            agentId,
            userInput: lastUserMessage,
            model: workspaceModel,
            llmProvider: isGeminiModel(workspaceModel) ? "gemini" : "ollama",
            installedAgentIds,
            accessibleAgentIds,
            recentMessages: messages.map((message) => ({
                role: message.role,
                content: message.content,
                taskId: message.taskId,
                agentId: message.agentId,
            })),
            attachments: body.attachments,
        });

        if (!resolution.ok) {
            await commitUsageSlot(uid, verifiedUser.email);
            console.info("[AgentWorkspaceChat] blocked", {
                userId: uid,
                chatId,
                agentId,
                status: resolution.status,
                meta: resolution.meta || null,
            });
            return streamChat(resolution.content, {
                status: resolution.status,
                selected_agent: agentId,
                ...(resolution.meta || {}),
            });
        }

        if (resolution.action === "list_capabilities") {
            await commitUsageSlot(uid, verifiedUser.email);
            const content = renderWorkspaceCapabilitiesText(agentId, resolution.agentName);
            return streamChat(content, {
                status: "success",
                selected_agent: agentId,
                selected_action: resolution.action,
                routing_source: "agent_workspace",
                handled_by: "workspace_capability_summary",
            });
        }

        const parentLLMRequest: Record<string, unknown> = {
            agent_required: agentId,
            action: resolution.action,
            parameters: resolution.route.parameters,
            reasoning: resolution.reason,
            routing_source: "agent_workspace",
            selected_by: "marketplace_workspace",
            route: resolution.route,
            resolved_entities: resolution.resolvedEntities,
        };

        const task = await createAgentTask({
            userId: uid,
            chatId,
            agentId,
            parentLLMRequest,
            agentInput: resolution.agentRequest,
            flow: {
                orchestration: "agent_workspace",
                workspace: {
                    agentId,
                    agentName: resolution.agentName,
                },
                route: resolution.route,
                resolved_entities: resolution.resolvedEntities,
                validation: resolution.validation,
            },
        });

        const {
            status: refreshedStatus,
            agentOutput: refreshedOutputMaybe,
        } = await executeAgentTaskAndReadBack(task);

        await commitUsageSlot(uid, verifiedUser.email);

        const agentSummary =
            typeof refreshedOutputMaybe?.message === "string" && refreshedOutputMaybe.message.trim()
                ? refreshedOutputMaybe.message.trim()
                : typeof refreshedOutputMaybe?.summary === "string" && refreshedOutputMaybe.summary.trim()
                    ? refreshedOutputMaybe.summary.trim()
                    : typeof refreshedOutputMaybe?.error === "string" && refreshedOutputMaybe.error.trim()
                        ? refreshedOutputMaybe.error.trim()
                        : "";

        if (
            refreshedStatus === "failed" ||
            refreshedStatus === "needs_input" ||
            refreshedStatus === "action_required"
        ) {
            return streamChat(
                agentSummary ||
                    `I could not finish that with ${resolution.agentName} yet. Please try again in a moment.`,
                {
                    status: refreshedStatus,
                    selected_agent: agentId,
                    selected_action: resolution.action,
                    routing_source: "agent_workspace",
                    validation: "passed",
                    execution_status: refreshedStatus,
                }
            );
        }

        const content =
            agentSummary ||
            [
                `Delegating to ${resolution.agentName}.`,
                "",
                `Action: ${resolution.action}`,
                "",
                `Reasoning: ${resolution.reason}`,
            ].join("\n");

        const payload = {
            type: "agent_task",
            taskId: task.taskId,
            agentId,
            status: refreshedStatus,
            content,
            meta: {
                selected_agent: agentId,
                selected_action: resolution.action,
                routing_source: "agent_workspace",
                validation: "passed",
                execution_status: refreshedStatus,
            },
        };

        console.info("[AgentWorkspaceChat] accepted", {
            userId: uid,
            chatId,
            agentId,
            action: resolution.action,
            taskId: task.taskId,
            validation: resolution.validation,
        });

        return streamEvents([
            { event: "agent_task", data: payload },
            { event: "done", data: payload },
        ]);
    } catch (error) {
        console.error("[AgentWorkspaceChat] failed", {
            agentId,
            error,
        });
        const message =
            error instanceof Error
                ? error.message
                : "The agent workspace could not process this request.";
        return streamChat(message, {
            status: "infrastructure_error",
            selected_agent: agentId,
        });
    }
}
