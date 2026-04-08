import type { BloomModelId } from "@/modules/bloom-ai/types";

export const BLOOM_MODELS: Array<{
    id: BloomModelId;
    label: string;
    helper: string;
}> = [
    {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        helper: "Fast everyday support for reminders, journaling, and planning.",
    },
    {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        helper: "Best for deeper reasoning across your notes, habits, and journal.",
    },
    {
        id: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        helper: "Lightweight responses with the lowest latency.",
    },
];

export const DEFAULT_BLOOM_MODEL: BloomModelId = "gemini-2.5-flash";
