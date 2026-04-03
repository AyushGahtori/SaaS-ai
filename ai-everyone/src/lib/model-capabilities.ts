export interface ChatModelDefinition {
    id: string;
    label: string;
    provider: "ollama" | "gemini";
    supportsFileUpload: boolean;
}

export const CHAT_MODELS: ChatModelDefinition[] = [
    {
        id: "qwen3.5:397b-cloud",
        label: "Cloud - High Accuracy",
        provider: "ollama",
        supportsFileUpload: false,
    },
    {
        id: "qwen2.5:7b",
        label: "Local - Fast",
        provider: "ollama",
        supportsFileUpload: false,
    },
    {
        id: "gemini-3-flash-preview",
        label: "Gemini 3 Flash Preview",
        provider: "gemini",
        supportsFileUpload: true,
    },
    {
        id: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro Preview",
        provider: "gemini",
        supportsFileUpload: true,
    },
    {
        id: "gemini-3.1-flash-lite-preview",
        label: "Gemini 3.1 Flash Lite Preview",
        provider: "gemini",
        supportsFileUpload: true,
    },
];

export const MODEL_FILE_UPLOAD_SUPPORT: Record<string, boolean> = CHAT_MODELS.reduce(
    (acc, model) => {
        acc[model.id] = model.supportsFileUpload;
        return acc;
    },
    {} as Record<string, boolean>
);

export function getModelById(modelId: string): ChatModelDefinition | null {
    return CHAT_MODELS.find((model) => model.id === modelId) || null;
}

export function isGeminiModel(modelId: string): boolean {
    const known = getModelById(modelId);
    if (known) return known.provider === "gemini";
    return modelId.toLowerCase().includes("gemini");
}

export function supportsFileUpload(modelId: string): boolean {
    if (Object.prototype.hasOwnProperty.call(MODEL_FILE_UPLOAD_SUPPORT, modelId)) {
        return MODEL_FILE_UPLOAD_SUPPORT[modelId];
    }
    return isGeminiModel(modelId);
}
