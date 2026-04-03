"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DRIVE_AUTH_REQUIRED_CODE, DRIVE_UPLOAD_SCOPE } from "@/modules/chat/upload/api";
import { getApp, getApps, initializeApp } from "firebase/app";
import {
    GoogleAuthProvider,
    getAuth,
    signInWithPopup,
    signOut,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type CodedError = Error & { code?: string };

const TOKEN_EXPIRY_SAFETY_WINDOW_MS = 60_000;
const DRIVE_UPLOAD_AUTH_APP_NAME = "drive-upload-auth";

function createDriveAuthError(
    message = "Please sign in to Google Drive to upload files from Drive."
): CodedError {
    const error = new Error(message) as CodedError;
    error.code = DRIVE_AUTH_REQUIRED_CODE;
    return error;
}

async function requestDriveTokenViaFirebasePopup(): Promise<{
    token: string;
    expiresAtMs: number;
}> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
        throw new Error("Please sign in to SnitchX first, then retry Drive upload sign-in.");
    }

    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_UPLOAD_SCOPE);
    provider.setCustomParameters({ prompt: "consent" });

    // Keep Drive upload auth isolated from the primary auth session.
    const driveAuthApp = getApps().some((app) => app.name === DRIVE_UPLOAD_AUTH_APP_NAME)
        ? getApp(DRIVE_UPLOAD_AUTH_APP_NAME)
        : initializeApp(auth.app.options, DRIVE_UPLOAD_AUTH_APP_NAME);

    const driveAuth = auth.app.name === DRIVE_UPLOAD_AUTH_APP_NAME ? auth : getAuth(driveAuthApp);

    let credentialResult;
    try {
        credentialResult = await signInWithPopup(driveAuth, provider);
    } finally {
        // Best effort cleanup so we don't retain an extra auth session.
        await signOut(driveAuth).catch(() => undefined);
    }

    const credential = GoogleAuthProvider.credentialFromResult(credentialResult);
    const token = credential?.accessToken || "";
    if (!token) {
        throw new Error("Google sign-in succeeded, but no Drive access token was returned.");
    }
    return {
        token,
        // Access token lifetime is typically ~1h in popup OAuth; use conservative window.
        expiresAtMs: Date.now() + 50 * 60 * 1000,
    };
}

export function useDriveUploadAuth() {
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
    const [isReady, setIsReady] = useState(true);
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);

    const hasValidToken = useMemo(() => {
        if (!accessToken || !expiresAtMs) return false;
        return Date.now() < expiresAtMs - TOKEN_EXPIRY_SAFETY_WINDOW_MS;
    }, [accessToken, expiresAtMs]);

    const clearDriveUploadSession = useCallback(() => {
        setAccessToken(null);
        setExpiresAtMs(null);
        setAuthError(null);
    }, []);

    const signInForDriveUpload = useCallback(async (): Promise<string> => {
        setAuthError(null);
        setIsSigningIn(true);

        try {
            const { token, expiresAtMs: tokenExpiryMs } =
                await requestDriveTokenViaFirebasePopup();
            setAccessToken(token);
            setExpiresAtMs(tokenExpiryMs);
            setAuthError(null);
            return token;
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Google Drive sign-in failed. Please try again.";
            setAuthError(message);
            throw createDriveAuthError(message);
        } finally {
            setIsSigningIn(false);
        }
    }, []);

    const requireDriveAccessToken = useCallback(async (): Promise<string> => {
        if (hasValidToken && accessToken) return accessToken;
        throw createDriveAuthError();
    }, [accessToken, hasValidToken]);

    useEffect(() => {
        setIsReady(true);
    }, []);

    return {
        isReady,
        isSigningIn,
        authError,
        hasValidToken,
        signInForDriveUpload,
        requireDriveAccessToken,
        clearDriveUploadSession,
    };
}
