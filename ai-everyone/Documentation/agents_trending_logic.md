# Trending Logic

## Current Implementation

The trending system uses a simple **score-based approach** stored on each agent document.

### Formula

```
trendingScore = installsLast7Days × 2 + rating × 10
```

Currently, the `trendingScore` is **pre-computed and stored** in each agent's Firestore document. The seed script sets initial values. In a future iteration this score should be recalculated periodically (e.g. via a Cloud Function on a schedule).

### How Trending Agents Are Fetched

1. `getTrendingAgents(count)` in `src/lib/firestore-agents.ts` queries the `agents` collection ordered by `trendingScore DESC` with a limit.
2. The frontend splits trending data into two sections:
   - **Trending This Week** — top 5 agents
   - **Trending This Month** — top 10 agents

### Responsible Files

| File | Role |
|------|------|
| `src/lib/firestore-agents.ts` | `getTrendingAgents()` — Firestore query |
| `src/modules/agents/ui/views/agents-view.tsx` | Calls the query and passes data to trending sections |
| `src/modules/agents/ui/components/agents-trending-section.tsx` | Renders the horizontal scroll UI |
| `scripts/seed-agents.ts` | Sets initial `trendingScore` values |

### Future Improvements

- Implement a Cloud Function that runs on a CRON schedule to recalculate `trendingScore` based on actual installs in the last 7 days.
- Consider separate fields for weekly and monthly scores.
- Weight by user engagement metrics (e.g. how often an agent is actually used).
