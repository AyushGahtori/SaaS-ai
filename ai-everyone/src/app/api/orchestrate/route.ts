import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import { runLangGraphOrchestration } from "@/lib/orchestrator/langgraph";
import { isGeminiModel } from "@/lib/model-capabilities";

interface OrchestrateBody {
    message?: string;
    messages?: Array<{
        role: string;
        content: string;
        taskId?: string;
        agentId?: string;
    }>;
    chatId?: string;
    model?: string;
    dryRun?: boolean;
}

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as OrchestrateBody;
    const message =
        typeof body.message === "string" && body.message.trim()
            ? body.message.trim()
            : Array.isArray(body.messages)
                ? [...body.messages].reverse().find((item) => item.role === "user")?.content?.trim() || ""
                : "";

    if (!message) {
        return NextResponse.json({ error: "message is required" }, { status: 400 });
    }
    if (!body.chatId && !body.dryRun) {
        return NextResponse.json({ error: "chatId is required" }, { status: 400 });
    }

    const model = body.model || process.env.OLLAMA_DEFAULT_MODEL || "gemini-3-flash-preview";
    const result = await runLangGraphOrchestration({
        userId: verifiedUser.uid,
        chatId: body.chatId || "dry-run",
        userInput: message,
        model,
        llmProvider: isGeminiModel(model) ? "gemini" : "ollama",
        recentMessages: body.messages || [{ role: "user", content: message }],
        dryRun: Boolean(body.dryRun),
    });

    return NextResponse.json({
        handled: result.handled,
        type: result.type,
        content: result.content,
        status: result.status,
        taskId: result.taskId,
        agentId: result.agentId,
        result: result.result,
        meta: result.meta,
        state: result.state,
    });
}
