import { GoogleGenAI } from "@google/genai";
import type { InterpretedTaskStatus } from "./error-patterns";

interface LlmExplainInput {
    agentId: string;
    rawError: string;
    agentInput?: Record<string, unknown>;
}

interface LlmExplainOutput {
    status: InterpretedTaskStatus;
    userMessage: string;
    rootCause: string;
    suggestedAction?: string;
    suggestedInputs?: string[];
    code?: string;
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL_FLASH_LITE || "gemini-2.5-flash-lite";

function normalizeStatus(value: unknown): InterpretedTaskStatus {
    if (value === "needs_input" || value === "action_required") return value;
    return "failed";
}

function safeParseJson(text: string): Record<string, unknown> | null {
    const trimmed = text.trim();
    if (!trimmed) return null;
    try {
        return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
        return null;
    }
}

export async function interpretErrorWithLlm(
    input: LlmExplainInput
): Promise<LlmExplainOutput | null> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return null;

    const ai = new GoogleGenAI({ apiKey });
    const prompt = [
        "You are an agent error interpreter.",
        "Return ONLY JSON with this shape:",
        '{"status":"failed|needs_input|action_required","userMessage":"...","rootCause":"...","suggestedAction":"...","suggestedInputs":["..."],"code":"..."}',
        "Rules:",
        "1) userMessage must be detailed and helpful, never vague or one-line generic.",
        "2) If the issue can be solved by user input, use status=needs_input.",
        "3) If sign-in/install/permissions are required, use status=action_required.",
        "4) For missing/ambiguous target errors, explicitly ask for one concrete value (example: file name, email, symbol, date).",
        "5) For needs_input, always include a practical next-step option (example: list next batch, reconnect account, provide exact identifier).",
        "6) Otherwise use status=failed.",
        "7) Never include markdown.",
        "Example style (do not copy literally):",
        "Hey, the agent couldn't complete that because the file name wasn't specific enough. Please share the exact file name. If you want, I can list recent files first and you can pick one.",
        "Another good example:",
        "I can continue right now, but I need one missing value: company symbol. You can send something like AAPL or TSLA, and I will run the report immediately.",
        `Agent ID: ${input.agentId}`,
        `Agent input: ${JSON.stringify(input.agentInput || {})}`,
        `Raw error: ${input.rawError}`,
    ].join("\n");

    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
        });
        const text = response.text?.trim() || "";
        const parsed = safeParseJson(text);
        if (!parsed) return null;

        const status = normalizeStatus(parsed.status);
        const userMessage =
            typeof parsed.userMessage === "string" && parsed.userMessage.trim()
                ? parsed.userMessage.trim()
                : "I couldn't complete this yet because one key detail is still missing. Please share one specific value (for example file name, email, symbol, or date), and I will retry immediately.";
        const rootCause =
            typeof parsed.rootCause === "string" && parsed.rootCause.trim()
                ? parsed.rootCause.trim()
                : "Unknown failure.";
        const suggestedAction =
            typeof parsed.suggestedAction === "string" && parsed.suggestedAction.trim()
                ? parsed.suggestedAction.trim()
                : undefined;
        const suggestedInputs = Array.isArray(parsed.suggestedInputs)
            ? parsed.suggestedInputs.map((value) => String(value)).filter(Boolean)
            : undefined;
        const code =
            typeof parsed.code === "string" && parsed.code.trim() ? parsed.code.trim() : undefined;

        return {
            status,
            userMessage,
            rootCause,
            suggestedAction,
            suggestedInputs,
            code,
        };
    } catch {
        return null;
    }
}
