// Firebase auth client hook — drop-in replacement for BetterAuth's useSession.
// Provides a React hook that listens to Firebase Auth state changes
// and returns session data in the same shape that the rest of the app expects.
"use client";

import { useState, useEffect } from "react";
import type { User } from "firebase/auth";

interface SessionUser {
  name: string;
  email: string;
  image: string | null;
}

interface SessionData {
  user: SessionUser;
}

/**
 * useSession — subscribes to Firebase Auth state.
 *
 * Returns:
 *   data   — `{ user: { name, email, image } }` when authenticated, `null` otherwise.
 *   isPending — `true` while the initial auth state is being resolved.
 *
 * This matches the interface previously provided by BetterAuth's `authClient.useSession()`,
 * so consumer components can use it without any structural changes.
 */
export function useSession(): { data: SessionData | null; isPending: boolean } {
  const [data, setData] = useState<SessionData | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let requestVersion = 0;
    let unsubscribe: (() => void) | undefined;

    const hydrateSession = async (firebaseUser: User | null) => {
      const currentVersion = ++requestVersion;

      if (firebaseUser) {
        let profileName = firebaseUser.displayName || "User";
        let profileEmail = firebaseUser.email || "";

        try {
          const { getUserProfile } = await import("@/lib/firestore");
          const profile = await getUserProfile(firebaseUser.uid);
          if (!isMounted || currentVersion !== requestVersion) return;

          if (typeof profile?.name === "string" && profile.name.trim()) {
            profileName = profile.name.trim();
          }

          if (typeof profile?.email === "string" && profile.email.trim()) {
            profileEmail = profile.email.trim();
          }
        } catch (err) {
          console.error("[useSession] Failed to load Firestore profile:", err);
        }

        if (!isMounted || currentVersion !== requestVersion) return;

        setData({
          user: {
            name: profileName,
            email: profileEmail,
            image: firebaseUser.photoURL || null,
          },
        });
      } else {
        setData(null);
      }
      setIsPending(false);
    };

    const setupSession = async () => {
      const [{ auth }, firebaseAuth] = await Promise.all([
        import("@/lib/firebase"),
        import("firebase/auth"),
      ]);

      if (!isMounted) return;

      unsubscribe = firebaseAuth.onAuthStateChanged(auth, (firebaseUser: User | null) => {
        void hydrateSession(firebaseUser);
      });
    };

    void setupSession().catch((error) => {
      console.error("[useSession] Failed to initialize auth:", error);
      if (isMounted) {
        setData(null);
        setIsPending(false);
      }
    });

    const handleProfileUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ name?: string; email?: string }>;
      const payload = customEvent.detail;
      if (!payload) return;

      setData((prev) => {
        if (!prev) return prev;
        return {
          user: {
            ...prev.user,
            name: payload.name?.trim() || prev.user.name,
            email: payload.email?.trim() || prev.user.email,
          },
        };
      });
    };

    window.addEventListener("Pian-profile-updated", handleProfileUpdate as EventListener);

    return () => {
      isMounted = false;
      unsubscribe?.();
      window.removeEventListener("Pian-profile-updated", handleProfileUpdate as EventListener);
    };
  }, []);

  return { data, isPending };
}
