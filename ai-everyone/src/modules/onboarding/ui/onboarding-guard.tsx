"use client";

/**
 * OnboardingGuard — checks if the current user has completed onboarding.
 *
 * If the user is new (onboardingComplete !== true), the onboarding survey
 * modal is rendered on top of the dashboard layout.
 *
 * Uses client-side Firestore to check the onboardingComplete flag,
 * since it's needed immediately on load.
 */

import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { OnboardingSurvey } from "@/modules/onboarding/ui/onboarding-survey";

interface OnboardingGuardProps {
    children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
    const [uid, setUid] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setUid(null);
                setOnboardingComplete(null);
                setChecking(false);
                return;
            }

            setUid(user.uid);

            try {
                const snap = await getDoc(doc(db, "users", user.uid));
                const complete = snap.exists() ? snap.data()?.onboardingComplete === true : false;
                setOnboardingComplete(complete);
            } catch (err) {
                console.error("[OnboardingGuard] error checking onboarding status:", err);
                // If we can't check, assume complete so we don't block indefinitely
                setOnboardingComplete(true);
            } finally {
                setChecking(false);
            }
        });

        return () => unsub();
    }, []);

    const handleSurveyComplete = () => {
        setOnboardingComplete(true);
    };

    // While checking auth state, render children silently
    if (checking) {
        return <>{children}</>;
    }

    // Show survey modal if onboarding not complete and we have a uid
    const showSurvey = uid && onboardingComplete === false;

    return (
        <>
            {children}
            {showSurvey && (
                <OnboardingSurvey
                    userId={uid}
                    onComplete={handleSurveyComplete}
                />
            )}
        </>
    );
}
