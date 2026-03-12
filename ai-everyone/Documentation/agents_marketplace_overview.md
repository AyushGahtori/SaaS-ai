# Agents Marketplace — Overview

The **Agents Marketplace** is an in-app plugin store where users browse, search, install, and manage AI agents. The design is inspired by the Microsoft Store layout.

---

## Architecture

```
┌────────────────────────────────────────────────────────┐
│  Frontend (Next.js — Client Components)                │
│                                                        │
│  /agents page route                                    │
│    └─ AgentsView                                       │
│         ├─ AgentsSearchBar                             │
│         ├─ AgentsFeaturedSection  (hero layout)        │
│         ├─ AgentsTrendingSection  (horizontal scroll)  │
│         └─ AgentsGrid            (responsive grid)     │
│                                                        │
│  All components use AgentCard / AgentCardFeatured       │
├────────────────────────────────────────────────────────┤
│  Data Layer (Firestore — client SDK)                   │
│                                                        │
│  src/lib/firestore-agents.ts  — agents collection      │
│  src/lib/firestore.ts         — users.installedAgents  │
├────────────────────────────────────────────────────────┤
│  tRPC API (optional server-side access)                │
│                                                        │
│  src/trpc/routers/agents.ts   — queries & mutations    │
│  src/trpc/routers/_app.ts     — merged into appRouter  │
├────────────────────────────────────────────────────────┤
│  Firestore Database                                    │
│                                                        │
│  Collection: agents           — all agent documents    │
│  Collection: users            — installedAgents[] field │
└────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/(auth)/(dashboard)/agents/page.tsx` | Route page at `/agents` |
| `src/modules/agents/ui/views/agents-view.tsx` | Main marketplace view |
| `src/modules/agents/ui/components/agent-card.tsx` | Reusable agent card |
| `src/modules/agents/ui/components/agent-card-featured.tsx` | Featured card variant |
| `src/modules/agents/ui/components/agents-search-bar.tsx` | Search bar |
| `src/modules/agents/ui/components/agents-featured-section.tsx` | Hero layout |
| `src/modules/agents/ui/components/agents-trending-section.tsx` | Horizontal scroll |
| `src/modules/agents/ui/components/agents-grid.tsx` | All agents grid |
| `src/lib/firestore-agents.ts` | Firestore CRUD for agents |
| `src/lib/firestore.ts` | User installedAgents helpers |
| `src/trpc/routers/agents.ts` | tRPC router |
| `scripts/seed-agents.ts` | Seed Firestore with sample agents |

---

## Getting Started

1. **Seed the database**: `npx tsx scripts/seed-agents.ts`
2. **Run the dev server**: `npm run dev`
3. **Navigate to**: `http://localhost:3000/agents`
