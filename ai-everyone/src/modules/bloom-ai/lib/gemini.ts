import { GoogleGenAI } from "@google/genai";
import { BLOOM_MODELS, DEFAULT_BLOOM_MODEL } from "@/modules/bloom-ai/constants/models";
import type { BloomContextSource, BloomMessage, BloomModelId, BloomSettings } from "@/modules/bloom-ai/types";

const SUPPORTED_MODELS = new Set(BLOOM_MODELS.map((item) => item.id));

export function resolveBloomModel(input: string | undefined): BloomModelId {
    if (input && SUPPORTED_MODELS.has(input as BloomModelId)) {
        return input as BloomModelId;
    }
    return DEFAULT_BLOOM_MODEL;
}

function buildContextBlock(context: Record<BloomContextSource, string[]>) {
    const sections = Object.entries(context)
        .filter(([, values]) => values.length > 0)
        .map(([key, values]) => `${key.toUpperCase()}:\n- ${values.join("\n- ")}`);
    return sections.join("\n\n");
}

function buildSystemInstruction(settings: BloomSettings) {
    const enabled = Object.entries(settings.dataAccess)
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .join(", ");

    return [
        "You are Bloom AI, a calm personal productivity assistant inside a dark workspace app.",
        "Your job is to help with planning, reflection, journaling, reminders, and next-step clarity.",
        "Keep replies grounded, warm, and practical.",
        "Use the user's saved context when it is relevant, but do not mention hidden system context unless asked.",
        "Prefer short paragraphs and actionable bullets when useful.",
        `Enabled personal context sources: ${enabled || "none"}.`,
    ].join("\n");
}

export async function generateBloomReply(input: {
    apiKey: string;
    modelId?: string;
    settings: BloomSettings;
    messages: BloomMessage[];
    context: Record<BloomContextSource, string[]>;
}) {
    const ai = new GoogleGenAI({ apiKey: input.apiKey });
    const contextBlock = buildContextBlock(input.context);
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    if (contextBlock) {
        contents.push({
            role: "user",
            parts: [
                {
                    text: `Relevant personal context for this conversation:\n${contextBlock}\n\nUse this only when it helps.`,
                },
            ],
        });
    }

    for (const message of input.messages) {
        if (!message.content.trim()) continue;
        contents.push({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
        });
    }

    const response = await ai.models.generateContent({
        model: resolveBloomModel(input.modelId),
        config: {
            temperature: 0.55,
            systemInstruction: buildSystemInstruction(input.settings),
        },
        contents: contents.length > 0 ? contents : [{ role: "user", parts: [{ text: "Hello" }] }],
    });

    return response.text?.trim() || "I’m here and ready. Tell me what you want to work through.";
}
