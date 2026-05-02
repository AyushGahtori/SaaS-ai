import type {
    IndexedEntity,
    LangGraphOrchestrationState,
    ResolvedEntities,
} from "./types";
import {
    extractOrdinalIndex,
    extractSenderHint,
    extractSubjectHint,
    normalizeForMatch,
    scoreTextMatch,
} from "./text";

function emptyResolution(): ResolvedEntities {
    return {
        message_id: null,
        file_id: null,
        row_index: null,
        subject: null,
        sender: null,
        thread_id: null,
        entity_source: "none",
        matched_entity: null,
        candidate_entities: [],
    };
}

function byIndex(items: IndexedEntity[], index: number): IndexedEntity | null {
    if (items.length === 0) return null;
    if (index === -1) return items[items.length - 1] || null;
    return items.find((item) => item.index === index) || items[index - 1] || null;
}

function rankEntities(
    items: IndexedEntity[],
    text: string,
    fields: Array<keyof IndexedEntity>
): IndexedEntity[] {
    const scored = items
        .map((item) => {
            const score = fields.reduce((best, field) => {
                const value = item[field];
                return Math.max(best, scoreTextMatch(text, String(value || "")));
            }, 0);
            return { item, score };
        })
        .filter((entry) => entry.score >= 45)
        .sort((left, right) => right.score - left.score);

    if (scored.length <= 1) return scored.map((entry) => entry.item);
    const topScore = scored[0].score;
    return scored.filter((entry) => entry.score >= topScore - 10).map((entry) => entry.item);
}

function extractDriveFileHint(text: string): string | null {
    const quoted = text.match(/["']([^"']{2,160})["']/);
    if (quoted?.[1]) return quoted[1].trim();

    const filename = text.match(/([A-Za-z0-9 _.-]+\.(?:pdf|docx?|txt|md|csv|json|pptx?|xlsx?))/i);
    if (filename?.[1]) {
        let candidate = filename[1].trim();
        candidate = candidate.replace(/^(?:please\s+)?(?:can you\s+|could you\s+)?/i, "");
        candidate = candidate.replace(/^(?:summarize|summarise|read|open|explain|find|search|show)\s+/i, "");
        candidate = candidate.replace(/^(?:(?:the|a|an|this|that|same|one|file|document|pdf)\s+)+/i, "");
        candidate = candidate.replace(/\s+/g, " ").trim();
        if (candidate.length > 1) return candidate;
    }

    const named = text.match(/\b(?:file|document|pdf)\s+(?:named|called)\s+(.+?)$/i);
    return named?.[1]?.trim() || null;
}

function toEmailResolution(entity: IndexedEntity, source: ResolvedEntities["entity_source"]): ResolvedEntities {
    return {
        message_id: entity.message_id || entity.id,
        row_index: entity.index,
        subject: entity.subject || null,
        sender: entity.sender || null,
        thread_id: entity.thread_id || null,
        entity_source: source,
        matched_entity: entity,
        candidate_entities: [entity],
    };
}

function toDriveResolution(entity: IndexedEntity, source: ResolvedEntities["entity_source"]): ResolvedEntities {
    return {
        ...emptyResolution(),
        file_id: entity.id,
        row_index: entity.index,
        subject: entity.title || entity.name || null,
        entity_source: source,
        matched_entity: entity,
        candidate_entities: [entity],
    };
}

function isContextualReference(text: string): boolean {
    const lower = normalizeForMatch(text);
    return /\b(this|that|it|same|selected)\s+(one|mail|email|message|item)?\b/.test(lower) ||
        /\b(this|that|same)\b/.test(lower);
}

function resolveGmailEmail(state: LangGraphOrchestrationState): ResolvedEntities {
    const existing = String(state.route.parameters.message_id || "").trim();
    if (existing) {
        return {
            ...emptyResolution(),
            message_id: existing,
            row_index: Number(state.route.parameters.row_index || 0) || null,
            entity_source: "direct",
        };
    }

    const emails = state.conversation_context.entity_index.gmail_emails;
    if (emails.length === 0) return emptyResolution();

    const text = state.normalized_input;
    const lower = normalizeForMatch(text);
    const lastReferenced = state.conversation_context.last_referenced_entity;
    const hasExplicitOrdinal =
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|top|last|bottom)\b/.test(lower) ||
        /\b(?:row|item|email|mail|message)\s+#?\d{1,2}\b/.test(lower) ||
        /\b(?:summarize|summarise|read|open|show|mark|select|choose)\s+(?:the\s+)?#?\d{1,2}\b/.test(lower);

    if (
        isContextualReference(text) &&
        !hasExplicitOrdinal &&
        lastReferenced?.kind === "gmail_email" &&
        (lastReferenced.message_id || lastReferenced.id)
    ) {
        return toEmailResolution(lastReferenced, "context");
    }

    const ordinal = isContextualReference(text) && !hasExplicitOrdinal
        ? null
        : extractOrdinalIndex(text);
    if (ordinal !== null) {
        const match = byIndex(emails, ordinal);
        if (match) return toEmailResolution(match, "context");
        return {
            ...emptyResolution(),
            row_index: ordinal,
            entity_source: "context",
        };
    }

    const senderHint = extractSenderHint(text);
    if (senderHint) {
        const candidates = rankEntities(emails, senderHint, ["sender"]);
        if (candidates.length === 1) return toEmailResolution(candidates[0], "context");
        if (candidates.length > 1) {
            return {
                ...emptyResolution(),
                sender: senderHint,
                entity_source: "context",
                candidate_entities: candidates,
            };
        }
    }

    const subjectHint = extractSubjectHint(text);
    if (subjectHint) {
        const candidates = rankEntities(emails, subjectHint, ["subject"]);
        if (candidates.length === 1) return toEmailResolution(candidates[0], "context");
        if (candidates.length > 1) {
            return {
                ...emptyResolution(),
                subject: subjectHint,
                entity_source: "context",
                candidate_entities: candidates,
            };
        }
    }

    const broadCandidates = rankEntities(emails, text, ["subject", "sender", "snippet"]);
    if (broadCandidates.length === 1) return toEmailResolution(broadCandidates[0], "heuristic");
    if (broadCandidates.length > 1) {
        return {
            ...emptyResolution(),
            entity_source: "heuristic",
            candidate_entities: broadCandidates,
        };
    }

    if (
        isContextualReference(text) &&
        lastReferenced?.kind === "gmail_email" &&
        (lastReferenced.message_id || lastReferenced.id)
    ) {
        return toEmailResolution(lastReferenced, "context");
    }

    if (/\b(this|that)\s+(one|mail|email|message)\b/.test(lower) && emails.length === 1) {
        return toEmailResolution(emails[0], "context");
    }

    return emptyResolution();
}

function resolveDriveFile(state: LangGraphOrchestrationState): ResolvedEntities {
    const existing = String(state.route.parameters.file_id || "").trim();
    if (existing) {
        return {
            ...emptyResolution(),
            file_id: existing,
            row_index: Number(state.route.parameters.row_index || 0) || null,
            entity_source: "direct",
        };
    }

    const files = state.conversation_context.entity_index.drive_files;
    if (files.length === 0) return emptyResolution();

    const text = state.normalized_input;
    const lower = normalizeForMatch(text);
    const hasExplicitOrdinal =
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|top|last|bottom)\b/.test(lower) ||
        /\b(?:row|item|file|document|pdf)\s+#?\d{1,2}\b/.test(lower) ||
        /\b(?:summarize|summarise|read|open|show|select|choose)\s+(?:the\s+)?#?\d{1,2}\b/.test(lower);

    const ordinal = isContextualReference(text) && !hasExplicitOrdinal
        ? null
        : extractOrdinalIndex(text);
    if (ordinal !== null) {
        const match = byIndex(files, ordinal);
        if (match) return toDriveResolution(match, "context");
        return {
            ...emptyResolution(),
            row_index: ordinal,
            entity_source: "context",
        };
    }

    const fileHint = extractDriveFileHint(text);
    if (fileHint) {
        const hintedCandidates = rankEntities(files, fileHint, ["name", "title", "snippet"]);
        if (hintedCandidates.length === 1) return toDriveResolution(hintedCandidates[0], "heuristic");
        if (hintedCandidates.length > 1) {
            return {
                ...emptyResolution(),
                subject: fileHint,
                entity_source: "heuristic",
                candidate_entities: hintedCandidates,
            };
        }
    }

    const broadCandidates = rankEntities(files, text, ["name", "title", "snippet"]);
    if (broadCandidates.length === 1) return toDriveResolution(broadCandidates[0], "heuristic");
    if (broadCandidates.length > 1) {
        return {
            ...emptyResolution(),
            entity_source: "heuristic",
            candidate_entities: broadCandidates,
        };
    }

    if (/\b(this|that)\s+(one|file|document|pdf)\b/.test(lower) && files.length === 1) {
        return toDriveResolution(files[0], "context");
    }

    return emptyResolution();
}

export function resolveContextualEntities(state: LangGraphOrchestrationState): ResolvedEntities {
    if (state.route.target_agent === "google-agent" && state.route.parameters.agent_type === "gmail") {
        const action = state.route.target_action || "";
        if (["read_email", "mark_as_read", "reply_email"].includes(action)) {
            return resolveGmailEmail(state);
        }
    }

    if (state.route.target_agent === "google-agent" && state.route.parameters.agent_type === "drive") {
        const action = state.route.target_action || "";
        if (action === "read_file") {
            return resolveDriveFile(state);
        }
    }

    return emptyResolution();
}

export function formatEntityChoices(entities: IndexedEntity[], max = 5): string {
    return entities
        .slice(0, max)
        .map((entity) => {
            const label = entity.subject || entity.title || entity.name || entity.id;
            const from = entity.sender ? ` from ${entity.sender}` : "";
            return `${entity.index}. ${label}${from}`;
        })
        .join("\n");
}
