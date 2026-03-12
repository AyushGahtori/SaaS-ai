# Agents Marketplace — Task List

## Phase 1: Backend (Firestore + tRPC)
- [ ] Create Firestore utility functions for `agents` collection (`src/lib/firestore-agents.ts`)
- [ ] Update [UserProfile](file:///e:/SaaS-ai/ai-everyone/src/lib/firestore.ts#17-24) in [src/lib/firestore.ts](file:///e:/SaaS-ai/ai-everyone/src/lib/firestore.ts) to include `installedAgents` array
- [ ] Create tRPC agents router (`src/trpc/routers/agents.ts`)
- [ ] Merge agents router into [_app.ts](file:///e:/SaaS-ai/ai-everyone/src/trpc/routers/_app.ts)
- [ ] Create Firestore seed script to populate initial agents (`scripts/seed-agents.ts`)

## Phase 2: Frontend — Agents Module
- [ ] Create agents module structure (`src/modules/agents/ui/views/`, `src/modules/agents/ui/components/`)
- [ ] Create agents page route (`src/app/(auth)/(dashboard)/agents/page.tsx`)
- [ ] Create `agents-view.tsx` — main marketplace view
- [ ] Create `agents-search-bar.tsx` — search bar component
- [ ] Create `agents-featured-section.tsx` — hero layout (1 large + 2 small)
- [ ] Create `agents-trending-section.tsx` — horizontal scroll section
- [ ] Create `agents-grid.tsx` — all agents grid section
- [ ] Create `agent-card.tsx` — reusable agent card component
- [ ] Create `agent-card-featured.tsx` — large featured card variant
- [ ] Create install/uninstall button logic with optimistic UI

## Phase 3: Sidebar Update
- [ ] Update sidebar `Agents` icon to a more fitting icon (Bot or Puzzle)

## Phase 4: Documentation
- [ ] `Documentation/agents_marketplace_overview.md`
- [ ] `Documentation/agents_database_schema.md`
- [ ] `Documentation/agents_trending_logic.md`
- [ ] `Documentation/agents_frontend_components.md`
- [ ] `Documentation/agents_api_endpoints.md`
- [ ] `Documentation/agents_install_flow.md`

## Phase 5: Verification
- [ ] Build check (`npm run build`)
- [ ] Visual verification via browser
