"use client";

import { auth } from "@/lib/firebase";

export class BloomApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

export async function bloomFetch<T>(
    path: string,
    options?: {
        method?: "GET" | "POST" | "PATCH" | "DELETE";
        body?: unknown;
    }
): Promise<T> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
        throw new BloomApiError("Authentication expired. Please sign in again.", 401);
    }

    const response = await fetch(path, {
        method: options?.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new BloomApiError(
            typeof payload.error === "string" ? payload.error : "Request failed.",
            response.status
        );
    }

    return payload as T;
}
