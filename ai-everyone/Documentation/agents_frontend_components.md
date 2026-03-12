# Frontend Components

All components live under `src/modules/agents/ui/`.

---

## Views

### `agents-view.tsx`
**Path**: `src/modules/agents/ui/views/agents-view.tsx`

Main marketplace orchestrator. Fetches all agent data from Firestore, manages search state, and composes all sub-sections:
- `AgentsSearchBar`
- `AgentsFeaturedSection`
- `AgentsTrendingSection` (×2)
- `AgentsGrid`

Handles auth listener, data fetching, and install/uninstall with optimistic UI updates.

---

## Components

### `agent-card.tsx`
**Path**: `src/modules/agents/ui/components/agent-card.tsx`

Reusable card for displaying an agent. Used in `AgentsGrid` and `AgentsTrendingSection`.

**Props**: `agent`, `isInstalled`, `onInstall`, `onUninstall`

**Features**: Icon, name, description (2-line clamp), category badge, star rating, install count, install/uninstall button, hover lift animation, glassmorphism.

---

### `agent-card-featured.tsx`
**Path**: `src/modules/agents/ui/components/agent-card-featured.tsx`

Larger featured variant with gradient overlay. Accepts a `large` boolean prop for the hero card.

**Props**: `agent`, `isInstalled`, `onInstall`, `onUninstall`, `large?`

---

### `agents-search-bar.tsx`
**Path**: `src/modules/agents/ui/components/agents-search-bar.tsx`

Full-width search input with `Search` icon. Controlled component.

**Props**: `value`, `onChange`

---

### `agents-featured-section.tsx`
**Path**: `src/modules/agents/ui/components/agents-featured-section.tsx`

Microsoft Store hero layout: 1 large card on the left + 2 smaller cards stacked on the right. Uses CSS Grid (`grid-cols-2` on desktop).

**Props**: `agents`, `installedAgentIds`, `onInstall`, `onUninstall`

---

### `agents-trending-section.tsx`
**Path**: `src/modules/agents/ui/components/agents-trending-section.tsx`

Horizontal scrolling row with snap scroll. Each card is 260px wide.

**Props**: `title`, `agents`, `installedAgentIds`, `onInstall`, `onUninstall`

---

### `agents-grid.tsx`
**Path**: `src/modules/agents/ui/components/agents-grid.tsx`

Responsive grid: 1 → 2 → 3 → 4 columns based on viewport. Shows empty state when no agents match search.

**Props**: `agents`, `installedAgentIds`, `onInstall`, `onUninstall`
