/**
 * Memory Retrieval & Semantic Ranking
 *
 * Uses TF-IDF cosine similarity to rank memories against a query.
 * No external embedding API required.
 *
 * Use cases:
 * - Ranking memories relevant to the current user message
 * - Picking the top K memories to inject into the LLM prompt
 *
 * NOT used for deduplication — that is done by exact normalized key+value match.
 */

import type { MemoryItem } from "@/lib/memory/types";
import { getActiveMemories } from "@/lib/memory/memory-repository.server";

// ---------------------------------------------------------------------------
// TF-IDF helpers
// ---------------------------------------------------------------------------

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 1);
}

function buildVector(tokens: string[], vocabulary: string[]): number[] {
    const tf: Record<string, number> = {};
    for (const t of tokens) tf[t] = (tf[t] ?? 0) + 1;

    return vocabulary.map((word) => {
        const termFreq = (tf[word] ?? 0) / (tokens.length || 1);
        return termFreq;
    });
}

function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }

    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export interface RankedMemory {
    memory: MemoryItem;
    score: number;
}

/**
 * Rank a list of memories by relevance to a query text using TF-IDF cosine similarity.
 */
export function rankMemoriesByRelevance(memories: MemoryItem[], query: string): RankedMemory[] {
    if (memories.length === 0) return [];

    // Build documents: query + all memories
    const docs = [
        query,
        ...memories.map((m) => `${m.key} ${m.value ?? ""} ${m.type}`),
    ];

    // Build vocabulary (union of all tokens)
    const allTokens = docs.flatMap(tokenize);
    const vocabulary = Array.from(new Set(allTokens));

    // Build TF vectors
    const vectors = docs.map((doc) => buildVector(tokenize(doc), vocabulary));
    const queryVector = vectors[0];

    const ranked: RankedMemory[] = memories.map((memory, i) => ({
        memory,
        score: cosineSimilarity(queryVector, vectors[i + 1]),
    }));

    // Sort descending by score
    return ranked.sort((a, b) => b.score - a.score);
}

/**
 * Fetch active memories for a user and return the top K most relevant to the query.
 * Returns an empty array if the user has no active memories.
 */
export async function getTopKMemories(
    uid: string,
    query: string,
    k = 7,
): Promise<MemoryItem[]> {
    const memories = await getActiveMemories(uid);
    if (memories.length === 0) return [];

    const ranked = rankMemoriesByRelevance(memories, query);

    // Return top K with non-zero relevance, or just top K regardless
    return ranked.slice(0, k).map((r) => r.memory);
}

/**
 * Format a set of memories as a compact string for prompt injection.
 */
export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
    if (memories.length === 0) return "";
    const lines = memories
        .filter((m) => m.value)
        .map((m) => `- ${m.key}: ${m.value}`);
    if (lines.length === 0) return "";
    return `[Relevant User Context]\n${lines.join("\n")}`;
}
