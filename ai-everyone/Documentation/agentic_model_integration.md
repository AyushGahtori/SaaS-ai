# Agentic Model Integration — Documentation

## Overview

This document describes the **agentic model integration** into SnitchX (AI Everywhere).
The system transforms the chat from a simple Ollama Q&A into an **agent orchestration platform** where the parent LLM can detect user intents and delegate tasks to specialized agents.

> [!TIP]
> For a detailed explanation of why we use the "Direct Execution" model in development versus a "Task Queue" in production, see the [Architecture: Dev vs Prod](file:///e:/SaaS-ai/ai-everyone/Documentation/architecture_dev_vs_prod.md) guide.

---

## Architecture

```
User sends message
    ↓
Frontend (ChatProvider)
    ↓ POST /api/chat { messages, userId, chatId }
API Route (route.ts)
    ↓ Injects orchestration system prompt
Ollama (qwen2.5:7b)
    ↓ Returns plain text OR structured JSON
    ↓
    ├─ Plain text → Normal chat response → Rendered in UI
    │
    └─ Agent JSON intent detected:
         ↓ Create agentTasks/{taskId} in Firestore (Admin SDK)
         ↓ Return { type: "agent_task", taskId, agentId }
    Frontend saves "agent" message, starts real-time listener
         ↓
    Local Dev (Next.js): executeAgentTask() calls agent server directly
    Production (GCP): Firebase Cloud Function triggers (onDocumentCreated)
         ↓
    Agent executes (e.g. Teams contact lookup)
         ↓ Returns structured result { type: "teams_call", url, ... }
    Task status updated to "success" + agentOutput
         ↓
    Frontend receives real-time update via Firestore listener
         ↓ Shows result card + action buttons
```

---

## Files Created/Modified

### New Files

| File | Purpose |
|------|---------|
| `src/lib/firebase-admin.ts` | Firebase Admin SDK init (server-side Firestore) |
| `src/lib/firestore-tasks.ts` | Client-side real-time listener for tasks |
| `src/lib/firestore-tasks.server.ts` | Server-side task creation + **Direct Execution (Local Dev)** |
| `src/modules/chat/ui/components/agent-task-message.tsx` | Agent task status card with action buttons |
| `agents/teams-agent/teams_agent.py` | Refactored Teams agent (from `assistant_agent.py`) |
| `agents/teams-agent/server.py` | FastAPI wrapper for the Teams agent |
| `agents/teams-agent/requirements.txt` | Python dependencies |
| `agents/teams-agent/.env.example` | Example environment variables |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/api/chat/route.ts` | Added orchestration system prompt, agent registry, intent detection, Firestore task creation |
| `src/modules/chat/types.ts` | Added `"agent"` role, `taskId`/`agentId` fields, `AgentRegistryEntry` |
| `src/modules/chat/context/chat-context.tsx` | Handles agent task responses, real-time task listeners, `taskStatuses` state |
| `src/modules/chat/db/messages.ts` | Stores/retrieves `taskId` and `agentId` for agent messages |
| `src/modules/chat/ui/components/chat-message-item.tsx` | Routes agent messages to `AgentTaskMessage` |
| `functions/index.js` | Cloud Function: `runAgentTask` trigger on `agentTasks/{taskId}` |
| `.env` | Added `AGENT_SERVER_URL`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_ID` |

---

## Agent Registry

The parent LLM's system prompt includes a registry of available agents. Located in `src/app/api/chat/route.ts`:

```typescript
const AGENT_REGISTRY: AgentRegistryEntry[] = [
    {
        id: "teams-agent",
        name: "Microsoft Teams Agent",
        description: "Handles Microsoft Teams actions...",
        actions: ["make_call", "send_message"],
        examplePrompts: ["Call Nandini on Teams", ...],
    },
];
```

To add a new agent:
1. Add an entry to `AGENT_REGISTRY` in `route.ts`
2. Add the agent's route to `AGENT_ROUTES` in `functions/index.js`
3. Create the agent's Python server in `agents/<agent-name>/`

---

## Firestore Schema — agentTasks

**Path**: `agentTasks/{taskId}` (top-level collection)

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | string | UUID v4 identifier |
| `userId` | string | Firebase Auth UID |
| `chatId` | string | Chat document ID |
| `agentId` | string | Agent identifier (e.g. "teams-agent") |
| `status` | string | `queued` → `running` → `success` / `failed` |
| `parentLLMRequest` | map | Original LLM intent JSON |
| `agentInput` | map | Parameters sent to the agent |
| `agentOutput` | map | Agent result (null until complete) |
| `createdAt` | timestamp | Task creation time |
| `startedAt` | timestamp | When Cloud Function starts processing |
| `finishedAt` | timestamp | When task reaches terminal state |
| `retryCount` | number | Number of failed attempts |

---

## Firestore Security Rules

Add these rules for the `agentTasks` collection:

```javascript
match /agentTasks/{taskId} {
    // Users can read their own tasks (for real-time listeners)
    allow read: if request.auth != null && resource.data.userId == request.auth.uid;
    // Tasks are created server-side via Admin SDK — no client writes
    allow create, update, delete: if false;
}
```

---

## Running the Agent Server (Inside Docker Container)

If running inside the `snitchx` container:

```bash
# 1. Enter the container
docker exec -it snitchx bash

# 2. Install pip (if missing)
apt-get update && apt-get install -y python3-pip

# 3. Install dependencies
cd /usr/src/app/ai-everyone/agents/teams-agent
python3 -m pip install -r requirements.txt --break-system-packages

# 4. Start the server
python3 server.py
# Server starts on http://localhost:8100
```

### Health Check (from host or container)
```
curl http://localhost:8100/health
→ {"status": "healthy", "agent": "teams-agent"}
```

### Test Endpoint
```
POST http://localhost:8100/teams/action
{
    "action": "make_call",
    "contact": "user@example.com"
}
→ {
    "status": "success",
    "type": "teams_call",
    "url": "msteams://teams.microsoft.com/l/call/0/0?users=user@example.com",
    "displayName": "user@example.com",
    "email": "user@example.com"
}
```

---

## Environment Variables

### Next.js App (.env)
| Variable | Value | Description |
|----------|-------|-------------|
| `AGENT_SERVER_URL` | `http://localhost:8100` | Agent server URL (internal to Docker) |
| `GRAPH_TENANT_ID` | (optional) | Microsoft Entra tenant ID |
| `GRAPH_CLIENT_ID` | (optional) | Microsoft Entra app client ID |

### Agent Server (agents/teams-agent/.env)
| Variable | Value | Description |
|----------|-------|-------------|
| `OLLAMA_URL` | `http://localhost:11434/api/chat` | Ollama server (internal to Docker) |
| `OLLAMA_MODEL` | `qwen2.5:7b` | LLM model name |
| `GRAPH_TENANT_ID` | Required for Teams | Microsoft Entra tenant ID |
| `GRAPH_CLIENT_ID` | Required for Teams | Microsoft Entra app client ID |
| `PORT` | `8100` | Server port |

---

## How Agent Selection Works

1. The user sends a message like "Call Nandini from Teams"
2. The `/api/chat` route prepends the orchestration system prompt to the message history.
3. The system prompt tells Ollama: "If the user's request matches an agent's capabilities, return JSON".
4. Ollama returns a JSON blob (e.g., `{"agent_required": "teams-agent", ...}`).
5. **Fuzzy Matching**: The backend cleans the ID and performs a fuzzy search. If Ollama outputs `agent_teams` or `Microsoft Teams Agent`, the backend correctly maps it to `teams-agent`.
6. **JSON Protection**: If Ollama outputs malformed JSON or an unknown agent, the backend catches this and returns a clean fallback error to the UI instead of raw code.
7. A task document is created in Firestore.
8. **Direct Execution**: For local dev, `route.ts` immediately triggers `executeAgentTask()` to call the agent directly (bypassing the Cloud Function).
9. The Python agent resolves the contact and returns a Teams URL.
10. The task status transitions: `Queued` -> `Running` -> `Success` (or `Failed`).
11. The frontend, listening to Firestore, updates the UI card in real-time.
12. The user sees the final result with an "Open Teams Call" button.
