# Agents Database Schema

## Firestore Collection: `agents`

Each document represents one AI agent in the marketplace.

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Display name of the agent |
| `description` | `string` | Short description shown on cards |
| `iconUrl` | `string` | URL (or data URI) of the agent icon |
| `category` | `string` | Category label (e.g. "Communication", "Productivity") |
| `installCount` | `number` | Total number of users who have installed this agent |
| `rating` | `number` | Average rating (0–5) |
| `createdAt` | `Timestamp` | When the agent was added to the marketplace |
| `isFeatured` | `boolean` | Whether the agent appears in the featured hero section |
| `trendingScore` | `number` | Score used to rank agents in trending sections |
| `tags` | `string[]` | Optional array of searchable tags |

**Document ID**: A slug-style string (e.g. `email-agent`, `code-assistant`).

### Example Document

```json
{
  "name": "Email Assistant",
  "description": "Compose, send, and manage emails automatically",
  "iconUrl": "data:image/svg+xml;base64,...",
  "category": "Communication",
  "installCount": 1240,
  "rating": 4.7,
  "isFeatured": true,
  "trendingScore": 87,
  "tags": ["email", "automation"],
  "createdAt": "<Firestore Timestamp>"
}
```

---

## Firestore Collection: `users`

Each user document (keyed by Firebase Auth UID) includes:

| Field | Type | Description |
|-------|------|-------------|
| `installedAgents` | `string[]` | Array of agent document IDs the user has installed |

This field is managed atomically using `arrayUnion` / `arrayRemove`.

---

## Responsible Files

| File | Role |
|------|------|
| `src/lib/firestore-agents.ts` | CRUD for the `agents` collection |
| `src/lib/firestore.ts` | `installedAgents` helpers on the `users` collection |
| `scripts/seed-agents.ts` | Populates `agents` with sample data |
