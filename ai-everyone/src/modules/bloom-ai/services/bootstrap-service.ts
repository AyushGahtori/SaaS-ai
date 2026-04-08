"use client";

import { bloomFetch } from "@/modules/bloom-ai/api/client";
import type { BloomWorkspaceSnapshot } from "@/modules/bloom-ai/types";

export async function fetchBloomWorkspace() {
    return bloomFetch<BloomWorkspaceSnapshot>("/api/bloom-ai/bootstrap");
}
