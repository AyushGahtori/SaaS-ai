function normalizeOllamaBaseUrl(value: string): string {
    const trimmed = (value || "").trim().replace(/\/+$/, "");
    if (!trimmed) return "";
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `http://${trimmed}`;
}

export function getServerOllamaBaseUrls(): string[] {
    const rawCandidates: string[] = [];
    const primary = process.env.OLLAMA_BASE_URL;
    if (primary && primary.trim()) rawCandidates.push(primary.trim());

    const fallbackEnv = process.env.OLLAMA_BASE_URL_FALLBACKS || "";
    if (fallbackEnv.trim()) {
        rawCandidates.push(
            ...fallbackEnv
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean)
        );
    }

    if (!process.env.VERCEL) {
        rawCandidates.push(
            "http://host.docker.internal:11434",
            "http://127.0.0.1:11434",
            "http://localhost:11434"
        );
    }

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const candidate of rawCandidates) {
        const normalized = normalizeOllamaBaseUrl(candidate);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        deduped.push(normalized);
    }

    if (deduped.length === 0 && !process.env.VERCEL) {
        deduped.push("http://127.0.0.1:11434");
    }

    return deduped;
}

