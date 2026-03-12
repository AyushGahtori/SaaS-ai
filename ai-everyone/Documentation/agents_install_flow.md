# Install / Uninstall Flow

End-to-end flow from button click to Firestore update.

---

## Install Flow

```
User clicks "Install" on AgentCard
        │
        ▼
AgentCard.handleClick()
  → sets loading = true
  → calls onInstall(agentId)
        │
        ▼
AgentsView.handleInstall(agentId)
  → installAgentForUser(uid, agentId)   // arrayUnion on users/{uid}
  → incrementInstallCount(agentId)       // increment on agents/{agentId}
  → updates local state (optimistic UI):
      - adds agentId to installedIds
      - increments installCount in allAgents, trendingAgents, featuredAgents
        │
        ▼
AgentCard re-renders
  → button shows "Installed" (green)
```

---

## Uninstall Flow

```
User clicks "Installed" button (hover shows uninstall intent)
        │
        ▼
AgentCard.handleClick()
  → sets loading = true
  → calls onUninstall(agentId)
        │
        ▼
AgentsView.handleUninstall(agentId)
  → uninstallAgentForUser(uid, agentId)  // arrayRemove on users/{uid}
  → decrementInstallCount(agentId)        // decrement on agents/{agentId}
  → updates local state (optimistic UI):
      - removes agentId from installedIds
      - decrements installCount (min 0)
        │
        ▼
AgentCard re-renders
  → button shows "Install"
```

---

## Responsible Files

| File | Role |
|------|------|
| `src/modules/agents/ui/components/agent-card.tsx` | Button click handler, loading/installed state |
| `src/modules/agents/ui/views/agents-view.tsx` | Calls Firestore functions, manages optimistic state |
| `src/lib/firestore.ts` | `installAgentForUser()`, `uninstallAgentForUser()` |
| `src/lib/firestore-agents.ts` | `incrementInstallCount()`, `decrementInstallCount()` |

---

## Error Handling

- If install/uninstall fails, the card catches the error and logs it.
- The `loading` spinner prevents double-clicks.
- Firestore `arrayUnion` / `arrayRemove` are idempotent (safe to retry).
