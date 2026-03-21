# Cost-Saving Measures for Memory Extraction

The Persona/Memory system is designed to be highly cost-efficient and performant, minimizing LLM usage and avoiding unnecessary database operations.

## 1. Multi-Layer Extraction Pipeline (Performance Guard)

To avoid calling the LLM (Layer 3) on every single message, we use a tiered approach:

*   **Layer 1: Regex Trigger Detector (Zero Cost)**
    *   **Action**: A fast, local regex scan checks for "I-statements" (e.g., "I am...", "My goal is...").
    *   **Saving**: If no trigger is found, the process stops immediately before any complex logic or LLM calls occur.
    
*   **Layer 2: Deterministic Slot Extraction (Zero Cost)**
    *   **Action**: Uses rule-based extractors for common roles, goals, and technical preferences.
    *   **Saving**: If Layer 2 successfully extracts the facts, we skip the LLM call entirely.

*   **Layer 3: LLM Escalation (Only When Needed)**
    *   **Action**: We only call Ollama for extraction when Layer 1 is triggered but Layer 2 cannot confidently parse the natural language.

---

## LLM Escalation Logic: If / Then

To make it crystal clear, here are the exact conditions for LLM (Layer 3) interaction:

### ❌ It will NOT go to the LLM if:
1.  **Layer 1 Fails**: The user message does not start with a recognized "I-statement" or "context-giving" pattern (e.g., "What is the capital of France?").
2.  **Layer 2 Succeeds**: The message is structured enough that our deterministic regex patterns catch it perfectly (e.g., "I am a web developer" fits the `ROLE_PATTERNS` perfectly).
3.  **Low Value Query**: The message is too short (under 5 characters) or is a simple question (detected by Layer 1's `QUESTION_STARTERS`).

### ✅ It WILL go to the LLM if:
1.  **Layer 1 YES + Layer 2 NO**: The message *looks* like a personal fact (passed Layer 1) but uses complex or natural language that the regex rules can't reliably parse.
    *   *Example*: "Lately, I've been diving deep into using different types of frontend frameworks like Next.js." (This passes Layer 1 but Layer 2 regex is too simple to "slot" it correctly, so it escalates to the LLM).
2.  **Multifact / Nuanced**: The message contains multiple pieces of overlapping context that a simple regex might miss or mis-categorize.

---

We do not inject the persona or memories into every single chat prompt.

*   **`isPersonalContextQuery` Detection**: We use matching (Layer 1 trigger logic) to see if the user's *current* question is asking for advice or personal recommendations (e.g., "What should I do?").
*   **Saving**: If the query is just a general question (e.g., "What is React?"), we save tokens by omitting the persona block and relevant memories from the system prompt.

---

## 3. Storage & Scaling Policies

*   **Hard Memory Cap (20 Items)**: We enforce a global cap of 20 active memories per user. This prevents the "unlimited growth" of user data and keeps retrieval costs (TF-IDF ranking) predictable and fast.
*   **Deduplication**: Before saving, we normalize the key/value pair. If the same fact is already stored, we skip the write operation entirely.
*   **Auto-Expiry (TTL)**: "Temporary" memories (contextual info like what they are currently building) expire after 30 days, keeping the database lean.

---

## 4. Asynchronous Execution (UX & Latency)

*   **Fire-and-Forget**: All extraction and persona rebuilding happens **after** the chat response is sent to the user.
*   **Saving**: The user never experiences "wait time" for extraction, and we avoid blocking critical resources for background processing.
