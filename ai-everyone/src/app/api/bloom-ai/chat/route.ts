import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseRequest } from "@/lib/server-auth";
import {
    appendConversationMessages,
    buildBloomContextSources,
    getBloomSettings,
    loadConversationForPrompt,
    upsertConversationMetadata,
} from "@/modules/bloom-ai/lib/server";
import { generateBloomReply, resolveBloomModel } from "@/modules/bloom-ai/lib/gemini";
import { normalizeUserFacingError } from "@/lib/errors/user-facing-errors";
import { commitUsageSlot, reserveUsageSlot, UsageLimitError } from "@/lib/usage-limit";

const BLOOM_USAGE_LIMIT = {
    envVarName: "BLOOM_AI_REQUESTS_PER_MONTH",
    fallbackLimit: 1000000,
};

export async function POST(req: NextRequest) {
    const verifiedUser = await verifyFirebaseRequest(req);
    if (!verifiedUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        const conversationId = String(body.conversationId || "").trim();
        const message = String(body.message || "").trim();
        const requestedModel = typeof body.modelId === "string" ? body.modelId : undefined;

        if (!conversationId) {
            return NextResponse.json({ error: "conversationId is required." }, { status: 400 });
        }

        if (!message) {
            return NextResponse.json({ error: "message is required." }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not configured on the server." },
                { status: 500 }
            );
        }
        await reserveUsageSlot(verifiedUser.uid, BLOOM_USAGE_LIMIT);

        const settings = await getBloomSettings(verifiedUser.uid);
        const { conversation, messages } = await loadConversationForPrompt(
            verifiedUser.uid,
            conversationId
        );
        const activeModel = resolveBloomModel(requestedModel || conversation.modelId || settings.modelId);
        const context = await buildBloomContextSources(verifiedUser.uid, settings);

        const reply = await generateBloomReply({
            apiKey,
            modelId: activeModel,
            settings: { ...settings, modelId: activeModel },
            messages: [
                ...messages,
                {
                    id: "pending-user",
                    role: "user",
                    content: message,
                    createdAt: new Date().toISOString(),
                },
            ],
            context,
        });
        await commitUsageSlot(verifiedUser.uid, BLOOM_USAGE_LIMIT);

        await upsertConversationMetadata(verifiedUser.uid, conversationId, {
            modelId: activeModel,
            title:
                conversation.title === "New Chat"
                    ? message.slice(0, 42) || "New Chat"
                    : conversation.title,
        });
        const updatedConversation = await appendConversationMessages(verifiedUser.uid, conversationId, [
            { role: "user", content: message },
            { role: "assistant", content: reply },
        ]);

        return NextResponse.json({ conversation: updatedConversation });
    } catch (error) {
        // Intercept our custom Bouncer error!
        if (error instanceof UsageLimitError) {
            return NextResponse.json(
                { error: "You have reached your AI message limit. Please upgrade to continue." },
                { status: 429 }
            );
        }

        // Otherwise, handle standard errors as usual
        console.error("[Bloom Chat]", error);
        const mapped = normalizeUserFacingError(error, {
            surface: "bloom",
            fallbackMessage: "Bloom AI could not reply right now.",
        });
        return NextResponse.json(
            { error: mapped.message },
            { status: 500 }
        );
    }
}

