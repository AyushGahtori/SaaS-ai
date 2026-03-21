# Persona / Memory — Firestore Schema

> All new collections live under the existing `users/{uid}` document.  
> The existing `users/{uid}` document and `users/{uid}/chats/{chatId}` are **unchanged**.

---

## Existing Schema (unchanged)

```
users/{uid}
  name: string
  email: string
  image: string | null
  createdAt: string (ISO)
  installedAgents: string[]
```

---

## New Fields Added to `users/{uid}`

```
users/{uid}
  ...existing fields...
  onboardingComplete: boolean   ← set to true after survey completion/skip
```

---

## New Sub-collections

### `users/{uid}/memories/{memoryId}`

Each document represents a single memory fact.

| Field | Type | Description |
|-------|------|-------------|
| `type` | `string` | One of: `identity`, `role`, `goal`, `preference`, `context`, `skill`, `project`, `education` |
| `key` | `string` | Canonical key, e.g. `role`, `answer_style`, `current_focus`, `tech_stack` |
| `value` | `string \| undefined` | The extracted value, or `undefined` if user skipped |
| `scope` | `"stable" \| "temporary"` | `temporary` memories expire; `stable` do not |
| `confidence` | `number` | 0–1. Survey answers = 1.0; LLM extraction varies |
| `source` | `"survey" \| "chat" \| "system"` | Where this memory came from |
| `status` | `"active" \| "superseded" \| "expired" \| "deleted"` | Only `active` memories are used |
| `createdAt` | `Timestamp` | When first created |
| `updatedAt` | `Timestamp` | Last update time |
| `expiresAt` | `Timestamp \| null` | Only set for `temporary` memories (30 days) |
| `sourceChatId` | `string \| null` | If from chat, which chat |
| `sourceMessageId` | `string \| null` | If from chat, which message |

**Canonical keys reference:**

| Key | Type | Scope | Example Value |
|-----|------|-------|---------------|
| `name` | `identity` | stable | `"Ayush"` |
| `role` | `role` | stable | `"developer"` |
| `current_goal` | `goal` | stable | `"build a SaaS product"` |
| `answer_style` | `preference` | stable | `"concise"` |
| `communication_style` | `preference` | stable | `"step-by-step"` |
| `current_focus` | `context` | temporary | `"preparing for interviews"` |
| `tech_stack` | `skill` | stable | `"React, Next.js"` |
| `current_project` | `project` | temporary | `"AI agent marketplace"` |
| `education_level` | `education` | stable | `"B.Tech"` |
| `university_goal` | `goal` | stable | `"get into MIT"` |

---

### `users/{uid}/persona/main`

Single document. Rebuilt after survey completion and after each memory extraction.

| Field | Type | Description |
|-------|------|-------------|
| `summary` | `string` | Short NL persona summary for LLM injection |
| `updatedAt` | `Timestamp` | Last rebuild time |
| `topFacts` | `string[]` | Top memory IDs used in current summary |
| `version` | `number` | Incremented on each rebuild |
| `generatedFrom` | `string[]` | Memory IDs that produced this summary |
| `role` | `string \| undefined` | Denormalized role for fast access |
| `current_focus` | `string \| undefined` | Denormalized focus |
| `answer_style` | `string \| undefined` | Denormalized preference |

---

### `users/{uid}/memorySettings/main` (optional, seeded on signup)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `maxTotalMemories` | `number` | `20` | Hard cap |
| `tempMemoryTTLDays` | `number` | `30` | Days before temporary memories expire |
| `requireConfirmation` | `boolean` | `false` | Ask user before saving chat-extracted memories |

---

## Predefined Skeleton Seed (on new user creation)

When a new user signs up, we immediately write the following to `users/{uid}/persona/main`:

```json
{
  "summary": "",
  "updatedAt": "<serverTimestamp>",
  "topFacts": [],
  "version": 0,
  "generatedFrom": [],
  "role": undefined,
  "current_focus": undefined,
  "answer_style": undefined
}
```

And seed a `memorySettings/main` doc with defaults.

Survey answers fill in the values. Skipped steps push `undefined` (field exists but value is undefined/null).

---

## Cap & Priority Policy

| Priority | Type | Max Count |
|----------|------|-----------|
| 1 (highest) | `role` | 1 |
| 2 | `goal` | 3 |
| 3 | `context` (current_focus) | 2 |
| 4 | `preference` | 3 |
| 5 | `skill` | 4 |
| 6 | `project` | 2 |
| 7 | `education` | 2 |
| 8 (lowest) | misc / temporary | 3 |

**Global hard cap**: 20 active memories. When exceeded, the lowest-priority and lowest-confidence memories are marked `deleted`.

---

## Firestore Security Rules

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // memories, persona, memorySettings are under users/{userId}/...
    // The wildcard above covers them. No additional rules needed.
    // Backend writes use Admin SDK (bypasses client rules).

  }
}
```
