// Firebase Authentication utility functions.
// Lazily imports Firebase modules so auth SDK is only loaded when the user
// triggers an auth action.

async function getFirebaseAuthContext() {
  const [{ auth }, firebaseAuth] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/auth"),
  ]);

  return { auth, firebaseAuth };
}

/**
 * Call the server-side API to seed predefined memory skeleton documents
 * for a brand-new user. Fire-and-forget - doesn't block sign-in flow.
 */
function seedNewUserMemory(uid: string): void {
  fetch("/api/user/seed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: uid }),
  }).catch((err) => console.error("[AuthClient] Failed to seed user memory:", err));
}

/**
 * Sign up a new user with email and password.
 * Also sets the displayName on the Firebase Auth profile and
 * creates a corresponding document in Firestore "users".
 */
export async function signUpWithEmail(name: string, email: string, password: string) {
  const [{ auth, firebaseAuth }, firestore] = await Promise.all([
    getFirebaseAuthContext(),
    import("@/lib/firestore"),
  ]);

  const userCredential = await firebaseAuth.createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  await firebaseAuth.updateProfile(userCredential.user, { displayName: name });

  await firestore.createUserProfile(userCredential.user.uid, {
    name,
    email,
    image: userCredential.user.photoURL || null,
    createdAt: new Date().toISOString(),
    onboardingComplete: false,
  });

  seedNewUserMemory(userCredential.user.uid);

  return userCredential.user;
}

/**
 * Sign in an existing user with email and password.
 */
export async function signInWithEmail(email: string, password: string) {
  const { auth, firebaseAuth } = await getFirebaseAuthContext();
  const userCredential = await firebaseAuth.signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

/**
 * Sign in (or sign up) using Google OAuth popup.
 * Creates a Firestore profile on first sign in.
 */
export async function signInWithGoogle() {
  const [{ auth, firebaseAuth }, firestore] = await Promise.all([
    getFirebaseAuthContext(),
    import("@/lib/firestore"),
  ]);

  const googleProvider = new firebaseAuth.GoogleAuthProvider();
  const userCredential = await firebaseAuth.signInWithPopup(auth, googleProvider);
  const user = userCredential.user;

  const existingProfile = await firestore.getUserProfile(user.uid);
  if (!existingProfile) {
    await firestore.createUserProfile(user.uid, {
      name: user.displayName || "User",
      email: user.email || "",
      image: user.photoURL || null,
      createdAt: new Date().toISOString(),
      onboardingComplete: false,
    });

    seedNewUserMemory(user.uid);
  }

  return user;
}

/**
 * Sign out the current user.
 */
export async function logOut() {
  const { auth, firebaseAuth } = await getFirebaseAuthContext();
  await firebaseAuth.signOut(auth);
}
