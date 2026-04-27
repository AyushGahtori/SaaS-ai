export type ErrorSurface =
    | "auth_sign_in"
    | "auth_sign_up"
    | "chat"
    | "bloom"
    | "upload"
    | "general";

export interface UserFacingError {
    title: string;
    message: string;
    code?: string;
    provider?: "firebase_auth" | "gemini" | "network" | "api" | "unknown";
    retryable?: boolean;
}

interface NormalizeErrorOptions {
    surface?: ErrorSurface;
    fallbackMessage?: string;
}

const DEFAULT_TITLES: Record<ErrorSurface, string> = {
    auth_sign_in: "Sign-in issue",
    auth_sign_up: "Sign-up issue",
    chat: "Chat issue",
    bloom: "Bloom AI issue",
    upload: "Upload issue",
    general: "Something went wrong",
};

const DEFAULT_MESSAGES: Record<ErrorSurface, string> = {
    auth_sign_in: "We could not sign you in. Please try again.",
    auth_sign_up: "We could not create your account right now. Please try again.",
    chat: "I could not complete that response right now. Please try again.",
    bloom: "Bloom AI could not complete that request right now. Please try again.",
    upload: "We could not complete that upload right now. Please try again.",
    general: "Something went wrong. Please try again.",
};

function readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) return error.message.trim();
    if (typeof error === "string" && error.trim()) return error.trim();
    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string" &&
        (error as { message: string }).message.trim()
    ) {
        return (error as { message: string }).message.trim();
    }
    return "";
}

function readErrorCode(error: unknown, message: string): string | null {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
    ) {
        const code = ((error as { code: string }).code || "").trim().toLowerCase();
        if (code) return code;
    }

    const firebaseMatch = message.match(/\b(auth\/[a-z-]+)\b/i);
    if (firebaseMatch?.[1]) return firebaseMatch[1].toLowerCase();

    const geminiStatusMatch = message.match(
        /\b(resource_exhausted|unavailable|internal|deadline_exceeded|permission_denied|failed_precondition|invalid_argument|not_found)\b/i
    );
    if (geminiStatusMatch?.[1]) return `gemini/${geminiStatusMatch[1].toLowerCase()}`;

    return null;
}

function readErrorStatus(error: unknown, message: string): number | null {
    if (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status?: unknown }).status === "number"
    ) {
        return (error as { status: number }).status;
    }

    const statusMatch = message.match(/\bstatus\s*[:=]?\s*(\d{3})\b/i);
    if (statusMatch?.[1]) return Number(statusMatch[1]);

    const httpMatch = message.match(/\b(400|401|403|404|408|409|413|429|500|502|503|504)\b/);
    if (httpMatch?.[1]) return Number(httpMatch[1]);

    return null;
}

function buildError(
    surface: ErrorSurface,
    partial: Omit<UserFacingError, "title" | "message"> & {
        title?: string;
        message: string;
    }
): UserFacingError {
    return {
        title: partial.title || DEFAULT_TITLES[surface],
        message: partial.message,
        code: partial.code,
        provider: partial.provider,
        retryable: partial.retryable,
    };
}

function mapFirebaseAuthError(
    code: string,
    surface: ErrorSurface
): UserFacingError | null {
    const isSignInSurface = surface === "auth_sign_in";
    const isSignUpSurface = surface === "auth_sign_up";

    if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
    ) {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            retryable: true,
            message: isSignInSurface
                ? "Wrong email or password. Please try again."
                : "Those credentials are not valid. Please check and try again.",
        });
    }

    if (code === "auth/email-already-in-use") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message: "That email is already in use. Please sign in or use a different email.",
        });
    }

    if (code === "auth/weak-password") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message:
                "Your password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.",
        });
    }

    if (code === "auth/invalid-email") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message: "Please enter a valid email address.",
        });
    }

    if (code === "auth/user-disabled") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message:
                "This account is disabled. Please contact support or try a different sign-in method.",
        });
    }

    if (code === "auth/too-many-requests" || code === "auth/quota-exceeded") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            retryable: true,
            message:
                "Too many attempts were detected. Please wait a moment and try again.",
        });
    }

    if (code === "auth/network-request-failed") {
        return buildError(surface, {
            code,
            provider: "network",
            retryable: true,
            message: "Network connection issue detected. Please check your internet and retry.",
        });
    }

    if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            retryable: true,
            message: "Sign-in popup was closed before completion. Please try again.",
        });
    }

    if (code === "auth/popup-blocked") {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message: "Your browser blocked the sign-in popup. Please allow popups and try again.",
        });
    }

    if (
        code === "auth/account-exists-with-different-credential" ||
        code === "auth/credential-already-in-use"
    ) {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message:
                "This account is linked to a different sign-in method. Please use the original provider.",
        });
    }

    if (
        code === "auth/requires-recent-login" ||
        code === "auth/user-token-expired" ||
        code === "auth/user-signed-out"
    ) {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            retryable: true,
            message: "Your session expired. Please sign in again.",
        });
    }

    if (
        code === "auth/unauthorized-domain" ||
        code === "auth/operation-not-allowed" ||
        code === "auth/app-not-authorized"
    ) {
        return buildError(surface, {
            code,
            provider: "firebase_auth",
            message:
                "Authentication is not fully configured for this environment. Please contact support.",
        });
    }

    if (!code.startsWith("auth/")) return null;

    return buildError(surface, {
        code,
        provider: "firebase_auth",
        retryable: true,
        message: isSignUpSurface
            ? "Authentication could not complete during sign-up. Please try again."
            : "Authentication could not complete. Please try again.",
    });
}

function mapGeminiError(
    code: string | null,
    status: number | null,
    message: string,
    surface: ErrorSurface
): UserFacingError | null {
    const normalized = (code || "").toLowerCase();
    const lower = message.toLowerCase();
    const geminiSignal =
        normalized.startsWith("gemini/") ||
        lower.includes("gemini") ||
        lower.includes("googlegenai") ||
        lower.includes("generatecontent");

    if (!geminiSignal && ![400, 403, 404, 429, 500, 503, 504].includes(status || -1)) {
        return null;
    }

    const mapByCode: Record<string, UserFacingError> = {
        "gemini/invalid_argument": buildError(surface, {
            code: "gemini/invalid_argument",
            provider: "gemini",
            message:
                "I could not process that request format. Please rephrase slightly and try again.",
        }),
        "gemini/failed_precondition": buildError(surface, {
            code: "gemini/failed_precondition",
            provider: "gemini",
            message:
                "This model request cannot run with the current project setup. Please verify billing and region setup, then retry.",
        }),
        "gemini/permission_denied": buildError(surface, {
            code: "gemini/permission_denied",
            provider: "gemini",
            message:
                "The AI provider rejected access for this request. Please check API permissions and try again.",
        }),
        "gemini/not_found": buildError(surface, {
            code: "gemini/not_found",
            provider: "gemini",
            message:
                "The requested Gemini model or resource could not be found. Please retry with a supported model.",
        }),
        "gemini/resource_exhausted": buildError(surface, {
            code: "gemini/resource_exhausted",
            provider: "gemini",
            retryable: true,
            message:
                "I am currently facing high traffic on the AI service. Please try again in a moment.",
        }),
        "gemini/internal": buildError(surface, {
            code: "gemini/internal",
            provider: "gemini",
            retryable: true,
            message:
                "The AI service hit an internal issue. Please retry shortly.",
        }),
        "gemini/unavailable": buildError(surface, {
            code: "gemini/unavailable",
            provider: "gemini",
            retryable: true,
            message:
                "The AI service is temporarily busy. Please try again shortly.",
        }),
        "gemini/deadline_exceeded": buildError(surface, {
            code: "gemini/deadline_exceeded",
            provider: "gemini",
            retryable: true,
            message:
                "This request took too long to process. Please try a shorter prompt or retry.",
        }),
    };

    if (normalized && mapByCode[normalized]) {
        return mapByCode[normalized];
    }

    if (status === 429) return mapByCode["gemini/resource_exhausted"];
    if (status === 503) return mapByCode["gemini/unavailable"];
    if (status === 504) return mapByCode["gemini/deadline_exceeded"];
    if (status === 500) return mapByCode["gemini/internal"];
    if (status === 403) return mapByCode["gemini/permission_denied"];
    if (status === 404) return mapByCode["gemini/not_found"];
    if (status === 400) return mapByCode["gemini/invalid_argument"];

    return null;
}

function mapApiStatus(surface: ErrorSurface, status: number | null): UserFacingError | null {
    if (!status) return null;

    if (status === 401) {
        return buildError(surface, {
            code: "http/401",
            provider: "api",
            retryable: true,
            message: "Your session expired. Please sign in again.",
        });
    }

    if (status === 403) {
        return buildError(surface, {
            code: "http/403",
            provider: "api",
            message: "You do not have permission for this action.",
        });
    }

    if (status === 404) {
        return buildError(surface, {
            code: "http/404",
            provider: "api",
            message: "The requested item could not be found.",
        });
    }

    if (status === 413) {
        return buildError(surface, {
            code: "http/413",
            provider: "api",
            message:
                "This file is too large for the current cloud upload path. Please try a smaller file.",
        });
    }

    if (status === 408 || status === 504) {
        return buildError(surface, {
            code: `http/${status}`,
            provider: "network",
            retryable: true,
            message: "The request timed out. Please try again.",
        });
    }

    if (status === 429) {
        return buildError(surface, {
            code: "http/429",
            provider: "api",
            retryable: true,
            message: "Too many requests right now. Please wait a moment and retry.",
        });
    }

    if (status >= 500) {
        return buildError(surface, {
            code: `http/${status}`,
            provider: "api",
            retryable: true,
            message: "A server issue occurred. Please try again shortly.",
        });
    }

    return null;
}

function mapNetworkPattern(surface: ErrorSurface, message: string): UserFacingError | null {
    const lower = message.toLowerCase();
    const patterns = [
        "failed to fetch",
        "network",
        "econnrefused",
        "timed out",
        "timeout",
        "connection reset",
    ];
    if (!patterns.some((item) => lower.includes(item))) return null;

    return buildError(surface, {
        code: "network/request-failed",
        provider: "network",
        retryable: true,
        message: "Network issue detected. Please check your connection and retry.",
    });
}

export function normalizeUserFacingError(
    error: unknown,
    options: NormalizeErrorOptions = {}
): UserFacingError {
    const surface = options.surface || "general";
    const surfaceMessage = options.fallbackMessage || DEFAULT_MESSAGES[surface];
    const rawMessage = readErrorMessage(error);
    const code = readErrorCode(error, rawMessage);
    const status = readErrorStatus(error, rawMessage);

    const firebaseMapped = code ? mapFirebaseAuthError(code, surface) : null;
    if (firebaseMapped) return firebaseMapped;

    const geminiMapped = mapGeminiError(code, status, rawMessage, surface);
    if (geminiMapped) return geminiMapped;

    const apiMapped = mapApiStatus(surface, status);
    if (apiMapped) return apiMapped;

    const networkMapped = mapNetworkPattern(surface, rawMessage);
    if (networkMapped) return networkMapped;

    if (rawMessage.toLowerCase().includes("gemini_api_key")) {
        return buildError(surface, {
            code: "gemini/api-key-missing",
            provider: "gemini",
            message:
                "AI service configuration is incomplete on the server. Please contact support.",
        });
    }

    if (rawMessage) {
        return buildError(surface, {
            code: code || undefined,
            provider: "unknown",
            message: surfaceMessage,
        });
    }

    return buildError(surface, {
        provider: "unknown",
        message: surfaceMessage,
    });
}

export function isRetryableHighTrafficGeminiError(error: UserFacingError): boolean {
    const code = (error.code || "").toLowerCase();
    return (
        code === "gemini/resource_exhausted" ||
        code === "gemini/unavailable" ||
        code === "gemini/internal" ||
        code === "gemini/deadline_exceeded"
    );
}

