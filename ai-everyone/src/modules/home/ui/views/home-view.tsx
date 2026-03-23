/**
 * HomeView — Main home page view component.
 *
 * Layout:
 *  - Full-screen centered container
 *  - Greeting text: "Hello {username}, Whats your agenda today?"
 *    fetched via tRPC `hello` query using the authenticated user's name.
 *  - AI Prompt Input Bar positioned below the greeting, centered.
 *    - LEFT button: AttachFile (for attaching files to the LLM prompt)
 *    - CENTER: Textarea for typing/pasting a prompt to send to the cloud LLM
 *    - RIGHT button: TextToSpeech (for voice input to populate the textarea)
 *
 * The input bar background uses the same CSS-variable-driven colour method
 * as the dashboard navbar search bar (bg-background / border-based outline).
 * The bar colour is set via `style={{ backgroundColor: '#0C0D0D' }}` to match
 * the exact #0C0D0D hex that the top search bar displays on screen.
 */

"use client";

import { useSession } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

// Import the two new action-button components
import { AttachFile } from "@/modules/home/ui/components/attach-file";
import { TextToSpeech } from "@/modules/home/ui/components/text-to-speech";
import VoiceModal, { type VoiceTranscriptEntry } from "@/modules/home/ui/components/VoiceModal";
import type { DeviceFlowData } from "@/modules/chat/ui/components/microsoft-login-card";
import { subscribeToTask } from "@/lib/firestore-tasks";

export const HomeView = () => {
  // Get the current authenticated session (user name, etc.)
  const { data: session } = useSession();

  // tRPC query — fetches a personalised greeting from the server.
  // The `hello` procedure accepts { text: string } and returns { greeting: string }.
  // We pass the authenticated user's name (or "User" as a fallback).
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.hello.queryOptions({
      text: session?.user?.name || "User",
    })
  );

  /**
   * Local state for the AI prompt text area.
   * This value will be sent to the cloud-based LLM when the feature is implemented.
   * TODO: Wire this up to the LLM API call (e.g., OpenAI, Gemini, Claude, etc.)
   */
  const [promptValue, setPromptValue] = useState("");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [authFlowData, setAuthFlowData] = useState<DeviceFlowData | null>(null);
  const [activeVoiceTaskId, setActiveVoiceTaskId] = useState<string | null>(null);

  // A random session ID for the voice conversation
  const [voiceChatId] = useState(() => `voice_${Math.random().toString(36).substring(7)}`);

  // Show a loading state while the session is being fetched
  if (!session) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  /**
   * Build the greeting string from the tRPC response.
   * The server returns `hello ${name}`, which we transform into the full
   * "Hello {name}, Whats your agenda today?" display text.
   * Capitalise the first letter to ensure proper formatting.
   *
   * Raw data?.greeting example: "hello Ayush"
   * Displayed as:              "Hello Ayush, Whats your agenda today ?"
   */
  const rawGreeting = data?.greeting ?? `hello ${session.user?.name || "User"}`;
  // Capitalise first char: "hello Ayush" → "Hello Ayush"
  const capitalisedGreeting =
    rawGreeting.charAt(0).toUpperCase() + rawGreeting.slice(1);
  // Append agenda text
  const displayGreeting = `${capitalisedGreeting}, Whats your agenda today ?`;

  // Handler stubs — passed to button components.
  // These will remain empty until AttachFile / TextToSpeech are implemented.

  /**
   * handleAttachFile — triggered when the user clicks the attach (+) button.
   * TODO: Implement file attachment logic in attach-file.tsx
   */
  const handleAttachFile = () => {
    // Intentionally left empty — implementation lives in attach-file.tsx
  };

  const handleTextToSpeech = () => {
    setShowVoiceModal(true);
  };

  /**
   * handleVoiceTranscript — triggered when VoiceModal finishes listening to an utterance.
   */
  const handleVoiceTranscript = async (
    text: string,
    callback: (response: string, actionUrl?: string) => void
  ) => {
    const userId = (session?.user as any)?.id || (session?.user as any)?.uid;
    if (!userId) {
      callback("Please sign in to use voice chat.");
      return;
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId,
          chatId: voiceChatId,
          messages: [{ role: "user", content: text }],
        }),
      });

      if (!res.ok) {
        throw new Error("API request failed");
      }

      const data = await res.json();

      if (data.type === "agent_task") {
        // Task created, observe it in Firestore
        const taskId = data.taskId;
        setActiveVoiceTaskId(taskId);

        const unsub = subscribeToTask(taskId, (task) => {
          if (!task) return;

          if (task.status === "action_required" && task.type === "device_auth") {
            setAuthFlowData(task.flow as unknown as DeviceFlowData);
          } else if (task.status === "success") {
            unsub();
            setActiveVoiceTaskId(null);

            // The agent finished. Now we typically want the LLM to summarize it.
            // But for voice, we can just say "I have completed that for you."
            const resultMsg = task.agentOutput?.message || "I have completed the task.";
            callback(resultMsg as string);
          } else if (task.status === "failed") {
            unsub();
            setActiveVoiceTaskId(null);
            callback("Sorry, I encountered an error while performing that task.");
          }
        });
      } else {
        // Direct LLM response
        callback(data.content || "I'm not sure what to say.");
      }
    } catch (err) {
      console.error("Voice chat error:", err);
      callback("Sorry, there was a problem connecting to the server.");
    }
  };

  return (
    /**
     * Full-height centred layout.
     * - `min-h-[calc(100vh-3.5rem)]` subtracts the navbar height (~56px / 3.5rem)
     *   so the content appears visually centred within the content area.
     * - `items-center justify-center` centres both axes.
     * - `flex-col gap-6` stacks greeting + input bar vertically with 24px gap.
     */
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-6 px-4">

      {/* ── Greeting Text ───────────────────────────────────────────── */}
      <h1 className="text-foreground text-4xl font-semibold tracking-tight text-center">
        {displayGreeting}
      </h1>

      {/* ── AI Prompt Input Bar ─────────────────────────────────────── */}
      {/**
       * Container: fixed width, centred, rounded border.
       * Background: #0C0D0D to match the top search bar colour exactly.
       * Border: uses the same `border` token (`var(--border)`) as the
       * dashboard search button — keeping the same visual method.
       * 
       * Structure:
       *   [ AttachFile (+) | <textarea "Ask anything..."> | TextToSpeech (mic) ]
       */}
      <div
        className="flex items-center w-full max-w-2xl rounded-full border border-white/5 px-4 py-2 gap-2"
        style={{ backgroundColor: "#0C0D0D" }}
      >
        {/* LEFT — Attach File button */}
        <AttachFile onClick={handleAttachFile} />

        {/**
         * AI Prompt Textarea
         * - Single-row by default; grows with content via `resize-none` + auto height
         *   (field-sizing-content or max-h limits can be added later).
         * - Placeholder: "Ask anything..." to cue the user.
         * - Background is transparent so the parent container colour shows through.
         * - No border/ring on the textarea itself — the outer container provides the border.
         *
         * TODO: When wiring to the LLM:
         *   1. Capture promptValue on submit (Enter key or a send button).
         *   2. Call the LLM API endpoint with promptValue as the user message.
         *   3. Display the response in a conversation thread below or in a modal.
         */}
        <textarea
          className="
            flex-1 bg-transparent text-base text-foreground placeholder:text-muted-foreground
            outline-none border-none resize-none overflow-hidden leading-6
            py-1 px-2
          "
          rows={1}
          placeholder="Ask anything..."
          value={promptValue}
          onChange={(e) => setPromptValue(e.target.value)}
          aria-label="AI prompt input"
          /* Allow Enter to submit in the future; Shift+Enter for newline */
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              /**
               * TODO: Trigger the LLM call here when the feature is ready.
               * e.g. handleSendPrompt(promptValue);
               */
            }
          }}
        />

        {/* RIGHT — Text To Speech (microphone) button */}
        <TextToSpeech onClick={handleTextToSpeech} />
      </div>

      {/* Voice Modal Overlay */}
      {showVoiceModal && (
        <VoiceModal
          onTranscript={handleVoiceTranscript}
          onClose={() => {
            setShowVoiceModal(false);
            setAuthFlowData(null);
            setActiveVoiceTaskId(null);
          }}
          authFlowData={authFlowData}
          onAuthComplete={() => setAuthFlowData(null)}
        />
      )}
    </div>
  );
};
