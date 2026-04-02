"use client";

import { useEffect } from "react";

function toLower(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function reasonIncludesFirebaseWebchannel(reason: unknown): boolean {
  if (!reason || typeof reason !== "object") return false;

  const rec = reason as Record<string, unknown>;
  const stack = toLower(rec.stack);
  const message = toLower(rec.message);
  const name = toLower(rec.name);
  const code = toLower(rec.code);

  const abortLike =
    name === "aborterror" ||
    code === "aborted" ||
    code === "cancelled" ||
    message.includes("user aborted") ||
    message.includes("signal is aborted");

  const firestoreLike =
    stack.includes("@firebase/webchannel-wrapper") ||
    stack.includes("webchannel_blob_es2018") ||
    stack.includes("@firebase/firestore");

  return abortLike && firestoreLike;
}

export function FirestoreAbortNoiseGuard() {
  useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!reasonIncludesFirebaseWebchannel(event.reason)) return;
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", onUnhandledRejection);
  }, []);

  return null;
}

