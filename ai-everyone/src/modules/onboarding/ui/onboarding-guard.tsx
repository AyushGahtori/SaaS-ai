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
import dynamic from "next/dynamic";

const OnboardingSurvey = dynamic(
    () => import("@/modules/onboarding/ui/onboarding-survey").then((module) => module.OnboardingSurvey),
    { ssr: false }
);

interface OnboardingGuardProps {
    children: React.ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
    const [uid, setUid] = useState<string | null>(null);
    const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let isMounted = true;
        let unsubscribe: (() => void) | undefined;

        const boot = async () => {
            const [{ auth, db }, firebaseAuth, firestore] = await Promise.all([
                import("@/lib/firebase"),
                import("firebase/auth"),
                import("firebase/firestore"),
            ]);

            if (!isMounted) return;

            unsubscribe = firebaseAuth.onAuthStateChanged(auth, async (user) => {
                if (!isMounted) return;

                if (!user) {
                    setUid(null);
                    setOnboardingComplete(null);
                    setChecking(false);
                    return;
                }

                setUid(user.uid);

                try {
                    const snap = await firestore.getDoc(firestore.doc(db, "users", user.uid));
                    const complete = snap.exists() ? snap.data()?.onboardingComplete === true : false;
                    if (!isMounted) return;
                    setOnboardingComplete(complete);
                } catch (err) {
                    console.error("[OnboardingGuard] error checking onboarding status:", err);
                    // If we can't check, assume complete so we don't block indefinitely
                    if (isMounted) setOnboardingComplete(true);
                } finally {
                    if (isMounted) setChecking(false);
                }
            });
        };

        void boot();

        return () => {
            isMounted = false;
            unsubscribe?.();
        };
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
