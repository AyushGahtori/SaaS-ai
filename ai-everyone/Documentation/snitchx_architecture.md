# Pian — Architecture, Data Flow & System Design

## 1. High-level summary

* **Parent LLM**: centralized orchestration model that receives user queries, decides which agent(s) are required, and emits a structured intent JSON that describes the task.
* **Agents**: modular workers (serverless functions or containers) that implement a defined interface (take prompt, optional credentials, perform actions, return structured results). Agents live in the marketplace (`/agents` collection) and can be installed by users.
* **Agent Runner / Worker**: secure runtime that executes an agent using the agent spec and user credentials (if required).
* **Orchestration / Queue**: reliable task queue (Pub/Sub / Cloud Tasks) to decouple parent LLM decisions from agent execution and for retry/monitoring.
* **Auth & Secrets**: Firebase Authentication for user identity, OAuth2 for third-party services (Gmail), tokens stored encrypted and only accessible to backend service account logic.
* **Storage & Logs**: Firestore as primary data store (agents metadata, installs, chats, tasks) and Cloud Storage for large artifacts (agent packages, attachments). Use Cloud KMS for encryption of sensitive fields.

---

## 2. Recommended Firebase / GCP services

* **Firebase Authentication** — user sign-in (email, Google, etc.) and identity.
* **Cloud Firestore** — primary structured DB for users, agents, installs, tasks, chat logs.
* **Firebase Cloud Functions (or Cloud Run)** — backend hooks: handle OAuth callback, execute server-side logic, enforce install increments, run light agents. For heavier agents prefer **Cloud Run** (containerized) or GKE.
* **Google Cloud Pub/Sub** or **Cloud Tasks** — task queue for agent runs (Pub/Sub for fan-out, Cloud Tasks for reliable per-task scheduling and rate control).
* **Cloud Storage** — store agent bundles, artifacts, attachments.
* **Vertex AI / OpenAI / external LLM provider** — parent LLM hosting (or use a hosted LLM service) with a backend API.

---

## 3. Data model (Firestore) — detailed

**Top-level collections**

### `users/{uid}` (document)

* `displayName` (string)
* `email` (string)
* `createdAt` (timestamp)
* `settings` (map)
* `installedAgents` (subcollection) — see below

### `users/{uid}/installedAgents/{agentId}`

* `agentId` (string)
* `installedAt` (timestamp)
* `config` (map) — user-customized settings for this agent
* `permissionScopes` (string[]) — OAuth scopes the user granted for this agent
* `credentialRef` (string) — pointer to `userSecrets/{uid}/{agentId}` or secret manager reference
* `agentVersion` (string)

### `agents/{agentId}` (marketplace)

(As you already have)

* `name`, `description`, `iconUrl`, `category`, `installCount`, `rating`, `isFeatured`, `trendingScore`, `tags`, `createdAt`, `manifestUrl` (string) — URL to agent runtime package or container image
* `manifest` (map) — optional inline manifest describing required scopes, runtime type (serverless/container), entry point, cost, sandbox level

### `agentTasks/{taskId}`

* `userId` (string)
* `agentId` (string)
* `status` (enum: queued, running, success, failed)
* `parentLLMRequest` (map) — the original LLM JSON intent
* `agentInput` (map) — final prompt passed to agent
* `agentOutput` (map) — structured result
* `createdAt`, `startedAt`, `finishedAt`
* `retryCount` (number)

### `userSecrets/{uid}/{agentId}` (optional collection)

* `encryptedRefreshToken` (string) — encrypted by KMS/Secret Manager
* `tokenLastRefreshed` (timestamp)
* `scopes` (string[])

### `chats/{chatId}` or `users/{uid}/chats/{chatId}`

* `messages` (array/map) — messages between user, parent LLM and agents
* `metadata` (map)

---

## 4. Example parent LLM output (tag-based contract)

```json
{
  "taskId": "uuid-v4",
  "agent_required": "email-agent",
  "agent_priority": "primary",
  "agent_args": {
    "subject": "Follow up: proposal submission",
    "body_instructions": "Compose a professional email for client 'ACME Corp' describing project delays, include apology and a two-point mitigation plan, sign as 'Ajay from Pian'",
    "attachments": []
  },
  "safety": {
    "requires_oauth": true,
    "required_scopes": ["https://www.googleapis.com/auth/gmail.send"],
    "max_execution_time_sec": 30
  },
  "trace": {
    "parentPrompt": "Explain the user's query or reasoning used to pick the agent"
  }
}
```

* This JSON is authoritative: the orchestrator enqueues it. Agent runners must validate the JSON against the agent manifest before execution.

---

## 5. Execution flow (detailed step-by-step)

1. **User -> Web UI**: user types a query.
2. **Frontend**: calls backend `POST /api/ask` with auth token (Firebase ID token).
3. **Backend (Parent LLM service)**: validates user, forwards the natural language to parent LLM (Vertex AI / OpenAI) using a system prompt that describes available agents (cached manifest). The LLM returns the canonical JSON intent (example above).
4. **Orchestrator**: validates JSON (ensures agent exists, scopes needed). If the agent requires OAuth scopes and user hasn't granted them, respond back to frontend with `requires_oauth` + link to OAuth flow.
5. **Queue**: enqueue the task in Pub/Sub / Cloud Tasks / `agentTasks` collection with `status=queued`.
6. **Agent Runner**: background worker (Cloud Function or Cloud Run) subscribed to queue picks the task, verifies user tokens (fetch encrypted refresh token from Secret Manager or Firestore `userSecrets`), refreshes access token if needed, runs the agent (either runs JS/Python code from manifest or calls a container image endpoint), supplies `agentInput` + credentials.
7. **Agent Execution**: agent performs actions (e.g., Gmail send). Agent returns a structured `agentOutput` with `status`, `messageId`, or user-visible results.
8. **Result Handling**: Agent runner writes `agentOutput` to `agentTasks/{taskId}`, updates `status`, writes logs to `logs/` or `users/{uid}/chats/{chatId}`. If configured, parent LLM is called again to generate a user-facing summary.
9. **Frontend Notification**: use Firestore real-time listeners or Firebase Cloud Messaging to notify frontend of completion; show result to user.

---


## 6. Firestore security rules & hardened patterns

* **Only allow users to write their install entry**; writing to `agents` collection is admin-only.
* **Increment installCount server-side**: client calls `installAgent` endpoint which triggers a **Callable Cloud Function** that validates the user, writes `users/{uid}/installedAgents/{agentId}`, and increments `agents/{agentId}.installCount` in a transaction. This prevents client manipulation.

Example snippet (rules) — **update** your rules to block direct installCount updates and installs by clients:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /agents/{agentId} {
      allow read: if request.auth != null;
      allow update: if false; // updates (like installCount) must be performed by server
      allow create, delete: if false;
    }

    match /userSecrets/{userId}/{secretId} {
      allow read, write: if false; // only backend service account may access via Admin SDK
    }

    match /agentTasks/{taskId} {
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow read: if request.auth != null && resource.data.userId == request.auth.uid;
      allow update: if false; // updates happen server-side
    }

  }
}
```

* **Important**: Keep `userSecrets` inaccessible to client rules. Use Admin SDK or IAM-scoped service accounts to manage secrets.

---

## 7. Agent runtime models and manifest contract

An agent manifest (on `agents/{id}.manifest`) describes:

* `runtime`: `cloud_function` | `container` | `hosted_api`
* `entrypoint`: path or URL
* `required_scopes`: list of OAuth scopes
* `sandbox_level`: `readonly` | `action` | `privileged`
* `timeout_sec`, `memory_mb`
* `input_schema` and `output_schema` (jsonschema)

**At runtime** the orchestrator validates the LLM JSON against `input_schema` and `required_scopes`.

---

## 8. Reliability, retries, observability

* **Retries**: Use Pub/Sub dead-letter topics or Cloud Tasks with retry policies. Keep idempotency tokens in `agentTasks` to avoid duplicate side-effects.
* **Monitoring**: Export logs to Cloud Logging, setup alerts for failures and high error rates.
* **Access auditing**: Record who triggered an agent and agent actions (audit logs) so users can see what was done in their name.

---

## 9. Security & privacy considerations

* **Explicit consent**: show scopes and purpose before installing an agent that requires access.
* **Granular revocation**: allow users to revoke tokens per agent.
* **Encryption**: encrypt refresh tokens at rest with KMS/Secret Manager.
* **Least privilege**: agents request the smallest possible set of scopes.
* **Code review**: ensure marketplace agents are vetted and sandboxed (do not allow arbitrary remote code execution without review).
* **Rate-limits & billing**: limit agent sends (e.g., emails per minute) to avoid abuse and unexpected costs.

---

## 10. Sample Cloud Function pseudo-workflow (Agent runner)

```js
// onPubSubTask JSON -> agentTasks doc created
exports.runAgent = async (pubsubEvent) => {
  const payload = JSON.parse(Buffer.from(pubsubEvent.data, 'base64').toString());
  const taskId = payload.taskId;
  // 1. Fetch agentTasks doc
  // 2. Lock/update status to 'running'
  // 3. Fetch agent manifest and userSecrets (via Admin SDK + KMS decrypt)
  // 4. Start agent execution (invoke container endpoint or run code)
  // 5. If requires external action, call provider with access token
  // 6. Save agentOutput to agentTasks doc and user chat collection
}
```

---

## 11. System Design Diagram (ASCII)

```
 [Web Client]
     |
     | Firebase Auth (ID Token)
     v
 [Parent LLM Service] <---- cached agent manifests
     |  (validate user, call LLM to pick agent)
     v
 [Queue: PubSub / Cloud Tasks] <--- enqueue canonical JSON
     |
     v
 [Agent Runner / Worker (Cloud Run / Function)]
     |  fetches userSecrets (Secret Manager/KMS)
     |  loads agent (container or code)
     v
 [External Services]
 (Gmail API, Calendar, Slack, etc.)

Results -> Firestore (agentTasks, chats) -> Frontend via Realtime listener
```

---

## 12. Data flow diagram (step bullets)

* UI -> `POST /api/ask` (with Firebase ID Token)
* Parent LLM service calls LLM and returns canonical JSON
* Orchestrator enqueues message in Pub/Sub
* Worker picks message -> loads user secrets -> runs agent -> performs action
* Worker updates `agentTasks/{taskId}` and writes chat/result to `users/{uid}/chats/{chatId}`
* Frontend sees update via Firestore listener or FCM push

---

## 13. Example UX flows (install + send email)

1. **Install agent**: user clicks `Install` on agent card -> App calls `installAgent` Cloud Function (callable). Function: create `users/{uid}/installedAgents/{agentId}`, increment `agents/{agentId}.installCount` (transaction), return success.
2. **Grant OAuth**: if agent needs Gmail scope, app shows consent screen link -> user consents -> OAuth callback stores encrypted refresh token server-side.
3. **Ask to send**: user asks "Send a follow-up email to ACME" -> parent LLM emits JSON -> orchestrator enqueues -> agent runner executes -> email sent -> frontend displays confirmation + sent message ID.

---

## 14. Additional recommendations & next steps

* Use **Cloud Run** for agent runners if agents can be heavier or need custom OS libs. Use serverless functions for light-weight tasks.
* Implement an **agent review pipeline** for marketplace submissions (automatic static checks + human review for privileged scopes).
* Build an **audit & consent UI** where users can see every action performed by agents and can revoke or re-run actions.
* Add **rate limiting and quotas** per user or agent to prevent abuse.

---

## 15. Appendix — sample Firestore document examples

**users/ajay@example.com/installedAgents/email-agent**

```json
{
  "agentId":"email-agent",
  "installedAt":"2026-03-13T15:00:00Z",
  "permissionScopes":["https://www.googleapis.com/auth/gmail.compose","https://www.googleapis.com/auth/gmail.send"],
  "credentialRef":"projects/myproject/secrets/user-123-email-agent-refresh-token",
  "config": {"signature":"Ajay from Pian"}
}
```

**agentTasks/abc-uuid**

```json
{
  "taskId":"abc-uuid",
  "userId":"uid-123",
  "agentId":"email-agent",
  "status":"queued",
  "agentInput": {"subject":"...","body_instructions":"..."},
  "createdAt":"2026-03-13T15:12:00Z"
}
```

---

If you'd like, I can also:

* produce an interactive **Mermaid** sequence diagram (or PNG export) and attach it,
* produce example Cloud Function / Cloud Run starter templates (Node.js / Python),
* write the exact **callable Cloud Function** implementations for install flow and OAuth callback.

*End of document.*
