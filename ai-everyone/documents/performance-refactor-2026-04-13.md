# Next.js Performance Refactor Report

Date: 2026-04-13
Scope: Dashboard routes (`/`, `/agents`, `/bloom-ai`, `/settings`) and shared app shell.

## Objectives

- Reduce initial JS and hydration cost on internal routes.
- Eliminate blank-screen auth waits and improve perceived loading.
- Defer Firebase SDK usage until needed.
- Split heavy route modules into lazy chunks.
- Add network and caching optimizations.

## Implemented Changes

### 1) Global layout provider slimming

- Removed global `TRPCReactProvider` from root layout.
- Added network hints in root head:
  - `dns-prefetch` + `preconnect` for Firebase endpoints.
- Kept root layout server-first (no global client provider).

Files:
- `src/app/layout.tsx`
- `src/components/performance/network-hints.tsx`

Impact:
- Prevents every page from paying React Query + tRPC hydration cost.
- Starts Firebase connection setup earlier via preconnect.

### 2) Route-level server wrappers + client chunk boundaries

Converted route entries into server wrappers that dynamically load route clients with immediate skeletons.

Routes updated:
- `/` -> `src/app/(auth)/(dashboard)/page.tsx` + `page.client.tsx`
- `/agents` -> `src/app/(auth)/(dashboard)/agents/page.tsx` + `page.client.tsx`
- `/bloom-ai` -> `src/app/(auth)/(dashboard)/bloom-ai/page.tsx` + `page.client.tsx`
- `/settings` -> `src/app/(auth)/(dashboard)/settings/page.tsx` + `page.client.tsx`
- `/sign-in` -> `src/app/(auth)/sign-in/page.tsx` + `page.client.tsx`

Shared loading UI:
- `src/components/performance/dashboard-route-skeleton.tsx`

Impact:
- Above-the-fold skeleton renders immediately (no blank white/black wait).
- Large route views load as independent chunks.

### 3) Auth guard modernization (no `return null` blocking)

Added reusable auth boundaries:
- `AuthenticatedRoute`
- `GuestOnlyRoute`

File:
- `src/components/auth/authenticated-route.tsx`

Impact:
- Session checks no longer produce empty screen states.
- Redirects remain intact while showing instant fallback UI.

### 4) Dashboard shell split: chat runtime only on chat route

Refactored dashboard layout to use a dedicated client shell that conditionally mounts chat runtime only for `/`.

Files:
- `src/app/(auth)/(dashboard)/layout.tsx`
- `src/modules/dashboard/ui/components/dashboard-shell-client.tsx`

Additional shell optimizations:
- Dashboard navbar and sidebar now load chat-specific widgets lazily.
- Chat history and command palette are only active when chat runtime exists.

Files:
- `src/modules/dashboard/ui/components/dashboard-navbar.tsx`
- `src/modules/dashboard/ui/components/dashboard-sidebar.tsx`
- `src/modules/chat/context/chat-context.tsx` (added optional hook)

Impact:
- `/agents`, `/settings`, and `/bloom-ai` avoid always mounting chat context/listeners.
- Less main-thread work and reduced route-level hydration load.

### 5) Firebase lazy initialization and token access

Added lazy Firebase client helpers:
- wait for authenticated user only when required.
- request ID token on demand.
- build auth headers lazily.

File:
- `src/lib/firebase-client-lazy.ts`

Refactored usage:
- `src/lib/auth-client.ts` now lazy-imports Firebase/Auth and Firestore profile reads.
- `src/lib/firebaseAuth.ts` now lazy-loads Firebase/Auth and Firestore per action.
- `src/modules/bloom-ai/api/client.ts` switched to lazy token helper.
- `src/modules/agents/ui/views/agents-view.tsx` removed eager auth listener startup.
- `src/modules/settings/ui/views/settings-view.tsx` uses lazy auth/token/profile update path.
- `src/modules/onboarding/ui/onboarding-guard.tsx` lazy-loads Firebase modules.

Impact:
- Firebase SDK work is deferred from initial route boot where possible.
- Fewer startup listeners and reduced request waterfalls on non-chat pages.

### 6) Heavy UI chunking in Bloom AI and Agents

Bloom AI view:
- Deferred large panels/components with dynamic imports:
  - sidebar, chat panel, settings sheet, reminders sheet, notes, habits, journal, labels.

File:
- `src/modules/bloom-ai/ui/views/bloom-ai-view.tsx`

Agents view:
- Deferred section components with dynamic imports:
  - search bar, featured section, trending sections, grid.
- Removed auth `onAuthStateChanged` subscription from view boot path.

File:
- `src/modules/agents/ui/views/agents-view.tsx`

Impact:
- Large secondary UI is not bundled/executed before critical shell render.
- Lower JS execution burst during first load.

### 7) Image optimization updates

Replaced raw `<img>` with Next `<Image />` on high-traffic cards and auth logos.

Files:
- `src/modules/agents/ui/components/agent-card.tsx`
- `src/modules/agents/ui/components/agent-card-featured.tsx`
- `src/modules/settings/ui/views/settings-view.tsx`
- `src/modules/auth/views/sign-in-views.tsx`
- `src/modules/auth/views/sign-up-views.tsx`

Impact:
- Better image decoding/loading behavior and improved payload handling.

### 8) Next config performance settings

Updated config:
- enabled compression.
- added `optimizePackageImports` for common heavy UI libs.
- enabled AVIF/WebP formats.
- added immutable cache headers for static assets and marketplace icons.

File:
- `next.config.js`

Impact:
- Better caching and smaller repeated navigation/download costs.

### 9) API response caching headers (safe short private cache)

Added short-lived private cache headers for user-scoped GET endpoints:
- `/api/agents`
- `/api/bloom-ai/bootstrap`

Files:
- `src/app/api/agents/route.ts`
- `src/app/api/bloom-ai/bootstrap/route.ts`

Impact:
- Reduces repeated fetch cost for rapid route revisits.

## Verification Executed

- TypeScript validation: `npx tsc --noEmit` -> passed.

Build note:
- `npm run build` currently fails in this environment due missing local binary:
  - `lightningcss.win32-x64-msvc.node`
- This is an environment/tooling issue, not from route refactor code.

## Recommended Post-merge Validation

1. Reinstall native deps and rerun production build.
2. Run Lighthouse for:
   - `/`
   - `/agents`
   - `/bloom-ai`
   - `/settings`
3. Compare against baseline for:
   - LCP
   - TBT
   - JS transferred
   - Main-thread time
4. Verify auth redirects still behave correctly on signed-in and signed-out sessions.

## Notes

- Existing unrelated modified files were left untouched.
- Refactor focused on startup cost, chunk boundaries, and perceived loading first.
- Next phase (if needed) should target server-prefetched user/session data to reduce client auth dependency even further.

## Addendum: Sidebar Chat Cache + Source Control Hygiene (2026-04-13)

### A) Fixed critical sidebar regression on `/agents`

Problem:
- Recent chats were hidden on non-chat routes after chat runtime isolation.

Fix:
- Added a lightweight, cached sidebar list that loads chat titles without mounting full chat runtime.
- Added `sessionStorage` handoff so clicking a chat from `/agents` opens that exact chat on `/`.
- Added `New Chat` handoff key so creating a new chat from non-chat routes still works.

Files:
- `src/modules/chat/ui/components/chat-sidebar-preview-list.tsx`
- `src/modules/chat/constants.ts`
- `src/modules/dashboard/ui/components/dashboard-sidebar.tsx`
- `src/modules/chat/context/chat-context.tsx`

### B) Fixed cache/environment artifacts showing in source control

Problem:
- Python virtualenv/cache artifacts (`venv`, `site-packages`, `.pyd`, etc.) appeared in SCM changes.

Fix:
- Expanded ignore patterns for Python runtime artifacts and caches in both repo-level and app-level `.gitignore`.

Files:
- `.gitignore`
- `ai-everyone/.gitignore`

### C) Reliable recent chats on non-chat routes (`/agents`, `/settings`)

Problem:
- Recent chats could fail to render on non-chat routes due client Firestore/auth timing and stale runtime fallbacks.

Fix:
- Added server-backed preview endpoint for chat titles.
- Sidebar preview now fetches from `/api/chats/preview` with Firebase bearer auth.
- Chat route sidebar writes previews into shared session cache so navigation away from `/` keeps chat names available instantly.
- Removed legacy fallback copy path; sidebar now shows either `Loading chats...`, cached/fetched chats, or `No chats yet`.

Files:
- `src/app/api/chats/preview/route.ts`
- `src/modules/chat/sidebar-cache.ts`
- `src/modules/chat/ui/components/chat-sidebar-preview-list.tsx`
- `src/modules/chat/ui/components/chat-sidebar-list.tsx`

## Addendum: Phase 2 JS + LCP Reduction (2026-04-13)

### 1) Homepage no longer loads tRPC/React Query

Problem:
- Home route was still pulling tRPC client/provider + TanStack Query for greeting text.

Changes:
- Removed `TRPCReactProvider` from home page route client.
- Replaced tRPC greeting call with static immediate greeting.

Files:
- `src/app/(auth)/(dashboard)/page.client.tsx`
- `src/modules/home/ui/views/home-view.tsx`

Expected impact:
- Cuts large non-essential JS from initial `/` load.
- Reduces main-thread execution and unused JS.

### 2) Split conversation-only chunks away from initial homepage render

Problem:
- `ChatView` imported `ChatMessageList` + full `ChatInput` even when no active chat.

Changes:
- Converted `ChatView` internals to dynamic imports.
- Conversation path (`ChatMessageList` and full `ChatInput`) now lazy loads only when needed.

File:
- `src/modules/chat/ui/views/chat-view.tsx`

Expected impact:
- Initial home render avoids conversation renderer bundle and heavy message-card code.

### 3) Added lightweight homepage composer

Problem:
- Full `ChatInput` includes upload/Drive/voice stack and was loaded on homepage.

Changes:
- Added `ChatInputLite` (text + model + send/stop only).
- Home route now uses `ChatInputLite`; full composer remains on conversation view.

Files:
- `src/modules/chat/ui/components/chat-input-lite.tsx`
- `src/modules/home/ui/views/home-view.tsx`

Expected impact:
- Faster home interactivity and lower LCP render delay.
- Significant reduction in initial JS parse/execute cost.

### 4) Deferred Firebase-heavy upload auth paths

Problem:
- Drive upload auth code eagerly imported Firebase app/auth on initial client bundle.

Changes:
- `upload/api.ts` switched to lazy token helper.
- `use-drive-upload-auth.ts` now lazy-imports Firebase app/auth only when Drive sign-in starts.
- `VoiceBar` task subscription switched to lazy import.

Files:
- `src/modules/chat/upload/api.ts`
- `src/modules/chat/upload/use-drive-upload-auth.ts`
- `src/modules/chat/ui/components/VoiceBar.tsx`

Expected impact:
- Reduces homepage and base chat bundle size by removing eager Firebase auth modules.

### 5) ChatProvider import deferral

Problem:
- Chat context eagerly imported chat DB modules and token path at startup.

Changes:
- Deferred chat DB module imports (`chats/messages`) to runtime callback usage.
- Switched token retrieval to `getFirebaseIdToken`.
- Switched task subscription to lazy import.

File:
- `src/modules/chat/context/chat-context.tsx`

Expected impact:
- Lower startup parse/execute and less up-front Firebase/Firestore footprint.

## Addendum: Home Quick-Action Emoji Rendering Fix (2026-04-13)

Problem:
- Home quick-action chips displayed text-only prefixes instead of emoji on some clients.

Fix:
- Updated quick-action emoji definitions to include emoji presentation selector (`\uFE0F`) for consistent rendering.
- Applied explicit emoji-capable font fallback stack on the quick-action icon span.

Files:
- `src/modules/home/ui/views/home-view.tsx`

Verification:
- TypeScript validation: `npx tsc --noEmit` -> passed.

## Addendum: Deterministic Home Emoji Asset Rendering (2026-04-13)

Problem:
- Some environments still rendered quick-action leading icons as text instead of emoji glyphs.

Fix:
- Switched home quick-action leading icons to local SVG emoji assets in `public/emoji`.
- Home quick-action chips now render the emoji icon via `next/image` from local static files, removing dependency on runtime emoji font glyph behavior.

Files:
- `src/modules/home/ui/views/home-view.tsx`
- `public/emoji/1f4c5.svg`
- `public/emoji/1f4de.svg`
- `public/emoji/1f4ac.svg`
- `public/emoji/1f4ca.svg`
- `public/emoji/1f4dd.svg`
- `public/emoji/2705.svg`
- `public/emoji/1f4e7.svg`

Verification:
- TypeScript validation: `npx tsc --noEmit` -> passed.

## Addendum: Reverted to Plain Inline Emoji Labels (2026-04-13)

Reason:
- Browser behavior differed with icon rendering paths and needed a simple, consistent fallback path for quick verification.

Change:
- Home quick-action chips now render plain inline emoji text labels (example: `📞 Call`) directly from component data.
- Removed local emoji SVG asset dependency from HomeView.

Files:
- `src/modules/home/ui/views/home-view.tsx`
- Removed: `public/emoji/*`

Verification:
- TypeScript validation: `npx tsc --noEmit` -> passed.

## Addendum: Emoji Rendering Stabilization Across Browsers (2026-04-13)

Problem:
- Browsers were still issuing `/emoji/*.svg` requests from stale client chunks even after UI changes, causing inconsistent icon rendering.

Fix:
- Home quick-action emojis are now rendered as plain inline emoji characters (literal unicode) with simple text+emoji spans.
- `ChatView` now imports `HomeView` directly (non-dynamic for HomeView only) to avoid stale split chunk behavior for this small route-state component.
- Cleared local Next build cache (`.next`) to remove stale references to `/emoji/*.svg`.

Files:
- `src/modules/home/ui/views/home-view.tsx`
- `src/modules/chat/ui/views/chat-view.tsx`

Verification:
- TypeScript validation: `npx tsc --noEmit` -> passed.

### Encoding hardening note

- Emoji values in `HomeView` quick actions are stored as Unicode escape literals (for example `\u{1F4DE}`) to avoid editor/terminal encoding corruption while still rendering as plain emoji text in UI.

## Addendum: Forced Chunk Cache-Bust for Home Emoji UI (2026-04-13)

Problem:
- Browsers continued showing stale quick-action UI variants (`/emoji/*.svg`, text labels like `CALENDAR/PHONE`) despite source updates.

Fix:
- Introduced new module paths and rewired dashboard home to them, forcing a new chunk identity:
  - `src/modules/home/ui/views/home-view-emoji.tsx`
  - `src/modules/chat/ui/views/chat-view-emoji.tsx`
  - `src/app/(auth)/(dashboard)/page.client.tsx` now imports `chat-view-emoji`.
- Added `data-home-view-version="emoji-v2"` on the new home wrapper for runtime verification.

Verification:
- TypeScript validation: `npx tsc --noEmit` -> passed.
