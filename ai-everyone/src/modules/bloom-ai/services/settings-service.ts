"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomContextSource, BloomSettings } from "@/modules/bloom-ai/types";

export function updateBloomSettings(input: {
    modelId?: BloomSettings["modelId"];
    dataAccess?: Partial<Record<BloomContextSource, boolean>>;
}) {
    return bloomFetch<{ settings: BloomSettings }>("/api/bloom-ai/settings", {
        method: "PATCH",
        body: input,
    });
}
