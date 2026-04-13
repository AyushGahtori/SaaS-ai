"use client";

import type { User } from "firebase/auth";

const DEFAULT_AUTH_WAIT_MS = 3500;

async function getAuthModule() {
  const [{ auth }, firebaseAuth] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/auth"),
  ]);

  return {
    auth,
    onAuthStateChanged: firebaseAuth.onAuthStateChanged,
    updateProfile: firebaseAuth.updateProfile,
  };
}

export async function waitForFirebaseUser(
  timeoutMs: number = DEFAULT_AUTH_WAIT_MS
): Promise<User | null> {
  const { auth, onAuthStateChanged } = await getAuthModule();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise<User | null>((resolve) => {
    let done = false;
    const timeout = window.setTimeout(() => {
      if (done) return;
      done = true;
      unsubscribe();
      resolve(auth.currentUser ?? null);
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (done) return;
      done = true;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(nextUser);
    });
  });
}

export async function getFirebaseIdToken(): Promise<string> {
  const user = await waitForFirebaseUser();
  const token = await user?.getIdToken();

  if (!token) {
    throw new Error("Authentication expired. Please sign in again.");
  }

  return token;
}

export async function getFirebaseAuthHeaders() {
  const token = await getFirebaseIdToken();

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getFirebaseCurrentUser() {
  const { auth } = await getAuthModule();
  return auth.currentUser;
}

export async function updateFirebaseProfile(input: { displayName?: string | null }) {
  const { auth, updateProfile } = await getAuthModule();
  const currentUser = auth.currentUser;
  if (!currentUser) return;
  await updateProfile(currentUser, input);
}
