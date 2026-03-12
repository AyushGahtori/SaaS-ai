# API Endpoints (tRPC)

The agents marketplace uses a tRPC router at `src/trpc/routers/agents.ts`, merged into the app router at `trpc.agents.*`.

---

## Queries

### `agents.getAll`
**Input**: none  
**Output**: `Agent[]`  
Returns all agents from the `agents` Firestore collection.

---

### `agents.getFeatured`
**Input**: none  
**Output**: `Agent[]`  
Returns agents where `isFeatured === true`.

---

### `agents.getTrending`
**Input**: `{ limit: number }` (1–50, default 10)  
**Output**: `Agent[]`  
Returns top agents sorted by `trendingScore` descending.

---

### `agents.search`
**Input**: `{ query: string }`  
**Output**: `Agent[]`  
Fetches all agents and filters client-side by name, category, or description matching the query string (case-insensitive).

---

### `agents.getUserInstalled`
**Input**: `{ userId: string }`  
**Output**: `string[]`  
Returns the array of agent IDs installed by the specified user.

---

## Mutations

### `agents.install`
**Input**: `{ userId: string, agentId: string }`  
**Output**: `{ success: true }`  
Adds `agentId` to the user's `installedAgents` array and increments the agent's `installCount`.

---

### `agents.uninstall`
**Input**: `{ userId: string, agentId: string }`  
**Output**: `{ success: true }`  
Removes `agentId` from the user's `installedAgents` array and decrements the agent's `installCount`.

---

## Responsible Files

| File | Role |
|------|------|
| `src/trpc/routers/agents.ts` | tRPC router definition |
| `src/trpc/routers/_app.ts` | Merges agents router into app |
| `src/trpc/client.tsx` | Client-side tRPC provider |
| `src/trpc/init.ts` | tRPC initialization |
