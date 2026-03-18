# Architecture: Local Development vs. Production Deployment

This document explains the technical rationale behind the **Direct Execution Architecture** used in local development and how it must evolve for a production-scale deployment on platforms like Vercel.

---

## 1. Local Development (The "Direct" Method)

During local development inside Docker, both the **Next.js app** and the **Python Agent** share the same environment (`localhost`).

### The Workflow
1. **Request**: User asks to "Call Aaron".
2. **Intent**: Next.js detects the intent via Ollama.
3. **Task**: Next.js creates a record in Firestore (for history).
4. **Trigger**: Next.js immediately calls `http://localhost:8100/teams/action`.
5. **Response**: The agent finishes its work, Next.js updates Firestore, and the UI reflects the change.

### Why we use it in Dev
* **Networking**: Firebase Cloud Functions cannot "see" your laptop's local IP address. Direct calls bypass this barrier.
* **Speed**: Zero overhead from cloud triggers.
* **Simplicity**: You don't need to deploy anything to Google Cloud to test a new agent feature.

---

## 2. The Production Challenge (Serverless Timeouts)

When you deploy to a platform like **Vercel**, the architecture must change because of the **"Short-Lived Function"** problem.

### The Problem (The "Light Bulb" Analogy)
Imagine your code is like a **light bulb** in a room:

*   **In Local Development**: The light stays on as long as your computer is plugged in. You can start a task, and even if you walk away, the task keeps running because the "room" stays powered on forever.
*   **On Vercel (Production)**: Vercel is like a room with a **motion-sensor light** that is extremely aggressive.
    1.  **The Trigger**: A user sends a message. The light snaps **ON**.
    2.  **The Work**: Your code starts the call to the Python agent.
    3.  **The Response**: Your code sends a message back to the user saying: *"I've started!"*
    4.  **The "Cut"**: The moment that message leaves your server, Vercel thinks the request is finished and **snaps the light OFF immediately**.

Because the power is cut, any background process trying to talk to the agent just **dies**. It never gets a chance to finish or update Firestore.

---

## 3. The Production Solution: Task Queues

To solve the timeout problem, we use a **Task Queue** system. Think of it like a busy restaurant:

### The Waiter Analogy
* **Direct Execution (Local Dev):** You (the user) tell the Waiter (Next.js) your order. The Waiter runs to the kitchen and stands there waiting for the chef. You have to wait for the Waiter to come back.
* **Task Queue (Production):** You tell the Waiter your order. The Waiter writes it on a **ticket** and sticks it on a **Board (The Queue)**. The Waiter immediately comes back to you and says "Order #45 is placed!". You can keep browsing. A **Chef (The Worker)** sees the ticket on the board, cooks the food, and rings a bell when it's done.

### Recommended Production Tech
| Component | Technology | Description |
| :--- | :--- | :--- |
| **Middleman** | [Upstash QStash](https://upstash.com/qstash) | A durable queue that stores the "ticket" and retries the agent until it succeeds. |
| **Execution** | Cloud Run / EC2 | A dedicated server that never "sleeps" and can handle long-running agent tasks. |
| **Original Design** | Firebase Cloud Functions | Uses Firestore triggers. Works in production once the Agent has a public URL. |

---

## 4. Summary: The Roadmap

1. **Current Status (MVP)**: Use **Direct Execution** to build and test features quickly on your local machine.
2. **Scaling Up**: Deploy your Python Agents to a server (like Google Cloud Run or AWS) so they have a **Public URL**.
3. **Going Live**: Switch the trigger back to **Firebase Cloud Functions** or **Upstash**. Since the agent now has a public URL, the cloud "middleman" can successfully send the task.

> [!IMPORTANT]
> The current code in `route.ts` and `firestore-tasks.server.ts` is optimized for **speed and ease of development**. It ensures you can iterate on agents without fighting cloud networking policies.
