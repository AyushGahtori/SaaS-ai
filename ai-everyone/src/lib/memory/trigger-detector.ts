/**
 * Layer 1 — Trigger Detector
 *
 * Lightweight regex-based check to determine if a user message
 * might contain memory-worthy information.
 *
 * Goal: HIGH PRECISION, not high recall.
 * We only proceed with extraction if the message clearly looks like
 * a personal statement, not a question or generic chat.
 *
 * This module has ZERO external dependencies — just pure TypeScript.
 */

const TRIGGER_PATTERNS: RegExp[] = [
    // Identity / name
    /^my name is [a-z]/i,

    // Role statements
    /^i am (a |an )?[a-z]/i,
    /^i'm (a |an )?[a-z]/i,
    /^i work as [a-z]/i,

    // Work / project statements
    /^i am working on .+/i,
    /^i'm working on .+/i,
    /^i'm currently (building|working|studying|learning|developing)/i,
    /^i am currently (building|working|studying|learning|developing)/i,
    /^i('m| am) (building|developing|creating) .+/i,

    // Preferences
    /^i prefer .+/i,
    /^i like (to |that |when )?.+/i,

    // Goals
    /^my goal is .+/i,
    /^my (main |primary |current )?goal .+/i,
    /^i want to (become|be|learn|build|get into|go to|join|create)/i,
    /^i('m| am) trying to .+/i,

    // Study / education
    /^i study .+/i,
    /^i('m| am) studying .+/i,
    /^i('m| am) learning .+/i,

    // Interview / context
    /^i('m| am) preparing for .+/i,
    /^i use .+/i,
    /^my (current )?focus is .+/i,
    /^my (current )?stack is .+/i,
    /^my (current )?tech stack .+/i,

    // Background
    /^i have (worked|experience|been) .+/i,
    /^i've been .+/i,
];

/**
 * Returns true if the message might contain a memory-worthy fact.
 * Only checks the BEGINNING of the message (high precision).
 */
export function isTriggerMessage(message: string): boolean {
    const normalized = message.trim().toLowerCase();

    // Reject empty or very short messages
    if (normalized.length < 5) return false;

    // Reject obvious questions (starts with question words)
    const questionStarters = /^(what|how|why|when|where|who|which|is |are |do |does |can |could |should |would |will |please |explain |tell me|show me|help me|give me)/i;
    if (questionStarters.test(normalized)) return false;

    for (const pattern of TRIGGER_PATTERNS) {
        if (pattern.test(message.trim())) {
            return true;
        }
    }

    return false;
}

/**
 * A lighter version — checks if a query likely needs personal context injection.
 * Used to decide whether to fetch persona for a chat reply.
 */
export function isPersonalContextQuery(message: string): boolean {
    const lower = message.toLowerCase();
    const PERSONAL_SIGNALS = [
        "what should i",
        "recommend",
        "for me",
        "my situation",
        "my goal",
        "my project",
        "my career",
        "am i",
        "based on my",
        "given my",
        "plan for me",
        "advice for me",
        "help me plan",
        "where do i start",
        "how should i",
    ];
    return PERSONAL_SIGNALS.some((signal) => lower.includes(signal));
}
