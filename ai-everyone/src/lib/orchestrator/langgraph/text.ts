const ORDINALS: Record<string, number> = {
    first: 1,
    "1st": 1,
    one: 1,
    "number 1": 1,
    second: 2,
    "2nd": 2,
    two: 2,
    "number 2": 2,
    third: 3,
    "3rd": 3,
    three: 3,
    "number 3": 3,
    fourth: 4,
    "4th": 4,
    four: 4,
    "number 4": 4,
    fifth: 5,
    "5th": 5,
    five: 5,
    "number 5": 5,
    sixth: 6,
    "6th": 6,
    six: 6,
    seventh: 7,
    "7th": 7,
    seven: 7,
    eighth: 8,
    "8th": 8,
    eight: 8,
    ninth: 9,
    "9th": 9,
    nine: 9,
    tenth: 10,
    "10th": 10,
    ten: 10,
    top: 1,
};

export function normalizeInput(value: string): string {
    return value
        .replace(/\s+/g, " ")
        .replace(/[“”]/g, "\"")
        .replace(/[’]/g, "'")
        .trim();
}

export function normalizeForMatch(value: unknown): string {
    return String(value || "")
        .toLowerCase()
        .replace(/<[^>]+>/g, " ")
        .replace(/[^a-z0-9@._+\-\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

export function includesAny(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
}

export function getNumericRequestCount(text: string): number | null {
    const lower = normalizeForMatch(text);
    if (/\b(all|every)\s+(emails?|mails?|files?|documents?|docs?|messages?|repos?|repositories|tasks?)\b/.test(lower)) {
        return 999;
    }

    const patterns = [
        /\b(?:last|latest|recent|show|list|retrieve|retrive|retreive|get|fetch|read)\s+(\d{1,4})\s+(?:emails?|mails?|files?|documents?|docs?|messages?|repos?|repositories|tasks?)\b/,
        /\b(\d{1,4})\s+(?:latest\s+|recent\s+|last\s+)?(?:emails?|mails?|files?|documents?|docs?|messages?|repos?|repositories|tasks?)\b/,
        /\b(?:top|first)\s+(\d{1,4})\s+(?:emails?|mails?|files?|documents?|docs?|messages?|repos?|repositories|tasks?)\b/,
    ];

    for (const pattern of patterns) {
        const match = lower.match(pattern);
        if (!match?.[1]) continue;
        const parsed = Number.parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
}

export function extractOrdinalIndex(text: string): number | null {
    const lower = normalizeForMatch(text);
    for (const [word, index] of Object.entries(ORDINALS)) {
        const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`\\b${escaped}\\b`).test(lower)) return index;
    }

    const digitMatch = lower.match(/\b(?:summarize|summarise|read|open|show|mark|select|choose)\s+(?:the\s+)?#?(\d{1,2})\b/);
    if (digitMatch?.[1]) {
        const parsed = Number.parseInt(digitMatch[1], 10);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 50) return parsed;
    }

    const rowMatch = lower.match(/\b(?:row|item|email|mail|message|file|task)\s+#?(\d{1,2})\b/);
    if (rowMatch?.[1]) {
        const parsed = Number.parseInt(rowMatch[1], 10);
        if (Number.isFinite(parsed) && parsed > 0 && parsed <= 50) return parsed;
    }

    if (/\b(last|bottom)\b/.test(lower)) return -1;
    return null;
}

export function extractEmailAddress(text: string): string | null {
    const match = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match?.[0] || null;
}

export function extractSubjectHint(text: string): string | null {
    const patterns = [
        /\bsubject\s+(?:is|with|called|named)?\s*[:\-]?\s*["']?(.+?)["']?\s*$/i,
        /\bwith\s+subject\s+["']?(.+?)["']?\s*$/i,
        /\babout\s+["']?(.+?)["']?\s*$/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        const value = match?.[1]?.trim();
        if (value && value.length > 2) return value;
    }
    return null;
}

export function extractSenderHint(text: string): string | null {
    const match = text.match(/\bfrom\s+(.+?)(?:\s+(?:about|with subject|subject|mail|email|message)\b|$)/i);
    const value = match?.[1]?.trim().replace(/^the\s+/i, "");
    if (!value || value.length < 2) return null;
    return value;
}

export function scoreTextMatch(needle: string, haystack: string): number {
    const normalizedNeedle = normalizeForMatch(needle);
    const normalizedHaystack = normalizeForMatch(haystack);
    if (!normalizedNeedle || !normalizedHaystack) return 0;
    if (normalizedHaystack === normalizedNeedle) return 100;
    if (normalizedHaystack.includes(normalizedNeedle)) return 80;
    if (normalizedNeedle.includes(normalizedHaystack) && normalizedHaystack.length > 4) return 65;

    const words = normalizedNeedle.split(/\s+/).filter((word) => word.length > 2);
    if (words.length === 0) return 0;
    const hits = words.filter((word) => normalizedHaystack.includes(word)).length;
    return Math.round((hits / words.length) * 60);
}

export function compactString(value: unknown, maxLength = 280): string {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 3)}...`;
}
