# Agents Marketplace — Implementation Plan

Build a scalable AI agent marketplace inspired by the Microsoft Store layout, integrated into the existing SnitchX application. Users can browse, search, install, and manage AI agents.

---

## Proposed Changes

### Backend — Firestore Layer

#### [NEW] [firestore-agents.ts](file:///e:/SaaS-ai/ai-everyone/src/lib/firestore-agents.ts)

Firestore CRUD operations for the `agents` collection, following the same pattern as [firestore.ts](file:///e:/SaaS-ai/ai-everyone/src/lib/firestore.ts):
- `getAllAgents()` — fetch all agents from the `agents` collection
- `getAgentById(id)` — fetch a single agent
- `getFeaturedAgents()` — query for `isFeatured === true`
- `getTrendingAgents(limit)` — query ordered by `trendingScore` desc
- `incrementInstallCount(agentId)` — atomically increment `installCount`
- `decrementInstallCount(agentId)` — atomically decrement `installCount`

**Agent document schema:**
```
agentId: string
name: string
description: string
iconUrl: string
category: string
installCount: number
rating: number
createdAt: Timestamp
isFeatured: boolean
trendingScore: number
```

#### [MODIFY] [firestore.ts](file:///e:/SaaS-ai/ai-everyone/src/lib/firestore.ts)

Add `installedAgents: string[]` field to the [UserProfile](file:///e:/SaaS-ai/ai-everyone/src/lib/firestore.ts#17-24) interface and add two new functions:
- `installAgentForUser(uid, agentId)` — uses `arrayUnion` to add agentId
- `uninstallAgentForUser(uid, agentId)` — uses `arrayRemove` to remove agentId
- `getUserInstalledAgents(uid)` — returns the `installedAgents` array

---

### Backend — tRPC API Layer

#### [NEW] [agents.ts](file:///e:/SaaS-ai/ai-everyone/src/trpc/routers/agents.ts)

New tRPC router with these procedures:
- `getAll` — query: returns all agents from Firestore
- `getFeatured` — query: returns featured agents (`isFeatured === true`)
- `getTrending` — query: returns top agents by `trendingScore`, accepts `{ limit: number }`
- `search` — query: accepts `{ query: string }`, filters agents by name/category client-side (Firestore doesn't support full-text — we fetch all then filter)
- `install` — mutation: accepts `{ userId, agentId }`, adds to user's `installedAgents`, increments `installCount`
- `uninstall` — mutation: accepts `{ userId, agentId }`, removes from user's `installedAgents`, decrements `installCount`
- `getUserInstalled` — query: accepts `{ userId }`, returns the user's `installedAgents` array

#### [MODIFY] [_app.ts](file:///e:/SaaS-ai/ai-everyone/src/trpc/routers/_app.ts)

Merge the new `agentsRouter` into the app router using `createTRPCRouter({ hello: ..., agents: agentsRouter })`.

---

### Backend — Seed Script

#### [NEW] [seed-agents.ts](file:///e:/SaaS-ai/ai-everyone/scripts/seed-agents.ts)

A Node.js script (run with `npx tsx scripts/seed-agents.ts`) that populates Firestore with 8 sample agents:
1. Email Assistant (Communication)
2. WhatsApp Messenger (Communication)
3. Meeting Scheduler (Productivity)
4. Calendar Agent (Productivity)
5. Document Analyzer (Analytics)
6. Research Agent (Research)
7. Translation Agent (Language)
8. Code Assistant (Development)

Each agent gets a placeholder icon URL (emoji-based SVG data URI since we don't have Firebase Storage set up — no external dependencies needed). `isFeatured` is set for 3 agents; `trendingScore`, `installCount`, and `rating` are pre-populated with sample values.

> [!NOTE]
> Icons use inline SVG data URIs with emoji text so the marketplace looks good immediately without needing Firebase Storage uploads. You can replace these with real icons stored in Firebase Storage later.

---

### Frontend — Agents Module

Following the existing pattern: `src/modules/agents/ui/views/` and `src/modules/agents/ui/components/`.

#### [NEW] [agents-view.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/agents/ui/views/agents-view.tsx)

Main marketplace view, composes all sections:
1. `AgentsSearchBar` at top
2. `AgentsFeaturedSection` (hero layout)
3. `AgentsTrendingSection` × 2 (week + month)
4. `AgentsGrid` (all agents)

Uses tRPC queries (`trpc.agents.getAll`, `trpc.agents.getFeatured`, `trpc.agents.getTrending`) and the user's installed agents list. Manages search state and passes filtered results down.

#### [NEW] [agents-search-bar.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/agents/ui/components/agents-search-bar.tsx)

Full-width search bar with a `Search` icon from `lucide-react`. Styled to match the dark theme (background `#0C0D0D`, border `white/10`). Controls search state via `value`/`onChange` props.

#### [NEW] [agents-featured-section.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/agents/ui/components/agents-featured-section.tsx)

Microsoft Store hero layout: 1 large card on the left, 2 smaller cards stacked on the right. Uses CSS Grid. Displays featured agents with gradient overlays, category badges, install buttons.

#### [NEW] [agents-trending-section.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/agents/ui/components/agents-trending-section.tsx)

Horizontal scrolling row of agent cards. Receives a `title` prop ("Trending This Week" / "Trending This Month") and an array of agents. Uses `overflow-x-auto` with `snap-x` for smooth scrolling. Each card uses the `AgentCard` component.

#### [NEW] [agents-grid.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/agents/ui/components/agents-grid.tsx)

Responsive grid displaying all agents. Uses CSS Grid with:
- Desktop: `grid-cols-4`
- Tablet: `grid-cols-2`
- Mobile: `grid-cols-1`

#### [NEW] [agent-card.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/agents/ui/components/agent-card.tsx)

Reusable agent card with:
- Agent icon (loaded from `iconUrl`)
- Name, short description, category badge
- Star rating display
- Install count
- Install / Installed / Uninstall button
- Hover animation (slight lift + shadow increase)
- Dark mode styling with glassmorphism effect

---

### Frontend — Route

#### [NEW] [page.tsx](file:///e:/SaaS-ai/ai-everyone/src/app/(auth)/(dashboard)/agents/page.tsx)

Route page at `/agents`, follows same pattern as the dashboard root page: auth-guarded, renders `AgentsView`.

---

### Sidebar Update

#### [MODIFY] [dashboard-sidebar.tsx](file:///e:/SaaS-ai/ai-everyone/src/modules/dashboard/ui/components/dashboard-sidebar.tsx)

Change the `Agents` icon from `Search` to `Bot` (from `lucide-react`) — more semantically appropriate for an AI agents section.

---

### Documentation

All docs created in `e:\SaaS-ai\ai-everyone\Documentation\`:

#### [NEW] [agents_marketplace_overview.md](file:///e:/SaaS-ai/ai-everyone/Documentation/agents_marketplace_overview.md)
Overview of the entire marketplace feature, architecture, and file locations.

#### [NEW] [agents_database_schema.md](file:///e:/SaaS-ai/ai-everyone/Documentation/agents_database_schema.md)
Firestore `agents` collection schema, `users.installedAgents` field, and which files handle them.

#### [NEW] [agents_trending_logic.md](file:///e:/SaaS-ai/ai-everyone/Documentation/agents_trending_logic.md)
How trending scores work, the current simple formula, and responsible files.

#### [NEW] [agents_frontend_components.md](file:///e:/SaaS-ai/ai-everyone/Documentation/agents_frontend_components.md)
All React components, their props, layout decisions, and file locations.

#### [NEW] [agents_api_endpoints.md](file:///e:/SaaS-ai/ai-everyone/Documentation/agents_api_endpoints.md)
tRPC procedures, inputs, outputs, and usage examples.

#### [NEW] [agents_install_flow.md](file:///e:/SaaS-ai/ai-everyone/Documentation/agents_install_flow.md)
End-to-end install/uninstall flow from button click through tRPC to Firestore.

---

## Verification Plan

### Automated Tests

1. **Build check**: Run `npm run build` in `e:\SaaS-ai\ai-everyone` to verify TypeScript compiles and no import errors exist.

### Browser Verification

2. **Visual check**: Open `http://localhost:3000/agents` in the browser and verify:
   - Search bar renders at the top
   - Featured section shows 1 large + 2 small cards
   - Two "Trending" horizontal scroll sections render
   - All Agents grid renders with responsive columns
   - Cards show icons, names, descriptions, categories, ratings
   - Hover animations work (cards lift on hover)
   - Install button is interactive

3. **Seed data**: Run `npx tsx scripts/seed-agents.ts` to populate Firestore, then reload the page to verify agents appear.

### Manual Verification (by user)

4. **Install flow**: Click "Install" on an agent card → button should change to "Installed" → verify in Firestore that `users/{uid}/installedAgents` contains the agent ID and `agents/{id}/installCount` incremented.

5. **Search**: Type in the search bar → agents should filter dynamically by name and category.

6. **Responsive**: Resize the browser window to check mobile/tablet/desktop layouts.
