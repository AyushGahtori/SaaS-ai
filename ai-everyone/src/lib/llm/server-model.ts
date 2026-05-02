import { GoogleGenAI } from "@google/genai";
import { getServerOllamaBaseUrls } from "@/lib/memory/server-ollama-base-urls";
import { isGeminiModel } from "@/lib/model-capabilities";

export interface ServerModelMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

interface GenerateModelTextParams {
    model?: string;
    llmProvider?: string;
    messages: ServerModelMessage[];
    temperature?: number;
    responseMimeType?: "application/json" | "text/plain";
    abortSignal?: AbortSignal;
}

function normalizeMessages(messages: ServerModelMessage[]): ServerModelMessage[] {
    return messages
        .map((message) => ({
            role: message.role,
            content: typeof message.content === "string" ? message.content.trim() : "",
        }))
        .filter((message) => Boolean(message.content));
}

function shouldUseGemini(model?: string, llmProvider?: string): boolean {
    if ((llmProvider || "").toLowerCase() === "gemini") return true;
    if ((llmProvider || "").toLowerCase() === "ollama") return false;
    return isGeminiModel(model || "");
}

export function parseJsonObject(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
    const source = fenced || trimmed;

    try {
        return JSON.parse(source) as Record<string, unknown>;
    } catch {
        const start = source.indexOf("{");
        const end = source.lastIndexOf("}");
        if (start >= 0 && end > start) {
            try {
                return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
            } catch {
                return null;
            }
        }
        return null;
    }
}

async function generateGeminiText(params: GenerateModelTextParams): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured on the server.");
    }

    const model =
        params.model ||
        process.env.GEMINI_MODEL_FLASH ||
        process.env.GEMINI_MODEL_FLASH_LITE ||
        "gemini-3-flash-preview";
    const normalized = normalizeMessages(params.messages);
    const systemInstruction = normalized
        .filter((message) => message.role === "system")
        .map((message) => message.content)
        .join("\n\n");
    const contents = normalized
        .filter((message) => message.role !== "system")
        .map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.content }],
        }));

    if (contents.length === 0) {
        contents.push({
            role: "user",
            parts: [{ text: "Hello" }],
        });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
        model,
        config: {
            temperature: params.temperature ?? 0,
            ...(params.responseMimeType ? { responseMimeType: params.responseMimeType } : {}),
            ...(systemInstruction ? { systemInstruction } : {}),
        },
        contents,
    });

    return response.text || "";
}

async function generateOllamaText(params: GenerateModelTextParams): Promise<string> {
    const model = params.model || process.env.OLLAMA_DEFAULT_MODEL || "qwen3.5:397b-cloud";
    const messages = normalizeMessages(params.messages);
    const baseUrls = getServerOllamaBaseUrls();
    const attempted: string[] = [];
    let lastError: unknown = null;

    for (const baseUrl of baseUrls) {
        attempted.push(baseUrl);
        try {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: params.abortSignal,
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        temperature: params.temperature ?? 0,
                    },
                    ...(params.responseMimeType === "application/json"
                        ? { format: "json" }
                        : {}),
                }),
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new Error(
                    `Ollama at ${baseUrl} returned ${response.status}${errorText ? `: ${errorText}` : ""}`
                );
            }

            const payload = (await response.json()) as {
                message?: { content?: string };
                response?: string;
            };
            const text = payload.message?.content || payload.response || "";
            if (text.trim()) return text;

            throw new Error(`Ollama at ${baseUrl} returned an empty response.`);
        } catch (error) {
            if (params.abortSignal?.aborted) {
                throw error;
            }
            lastError = error;
        }
    }

    const details =
        lastError instanceof Error ? lastError.message : String(lastError || "Unknown error");
    throw new Error(
        `Unable to reach Ollama. Tried: ${attempted.join(", ")}. Last error: ${details}`
    );
}

export async function generateModelText(
    params: GenerateModelTextParams
): Promise<string> {
    return shouldUseGemini(params.model, params.llmProvider)
        ? generateGeminiText(params)
        : generateOllamaText(params);
}

export async function generateModelJson(
    params: GenerateModelTextParams
): Promise<{
    text: string;
    parsed: Record<string, unknown> | null;
}> {
    const text = await generateModelText({
        ...params,
        responseMimeType: "application/json",
        temperature: params.temperature ?? 0,
    });
    return {
        text,
        parsed: parseJsonObject(text),
    };
}
