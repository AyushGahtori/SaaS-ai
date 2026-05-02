# New Agent Integration Audit

## Source Agents

1. LeadGen Agent
   - Features: autonomous search, company enrichment, LinkedIn lookup, email finding, lead scoring, MongoDB storage, Redis conversation memory, session management.
   - Edge cases: empty prompts, missing API keys, duplicate or low-confidence leads, unavailable MongoDB or Redis, long-running lead searches.
   - Caching/state: Redis session memory plus MongoDB lead persistence from the copied source.
   - Backend dependencies: search/enrichment keys, MongoDB, Redis, configured LLM provider.
   - Security risks: prospect data and API keys must stay in env/config, never in prompts or UI logs.
   - UI needs: run prompt, lead list, session ID, history, clear/new session actions.

2. Marketing Agent
   - Features: product image analysis, content generation, poster HTML generation and editing, social copy, hashtags, campaigns, ad copy, generated-content persistence, provider switching, MongoDB and Redis state.
   - Edge cases: missing image context, missing provider key, stale latest-poster HTML, upload size/type limits, unavailable database/cache.
   - Caching/state: Redis session state plus MongoDB generated-content and product-analysis records.
   - Backend dependencies: image-capable LLM provider, MongoDB, Redis, optional provider API keys.
   - Security risks: uploaded product images and provider keys must not be echoed as raw payloads.
   - UI needs: prompt, image upload, provider switcher, session history/content, product context controls.

3. ARIA Podcast Agent
   - Features: host mode, creator mode, mode detection, podcast script generation, research tools, session memory, voice input, STT, TTS.
   - Edge cases: unclear audio, unsupported modes, missing TTS provider, missing session history, invalid audio payload.
   - Caching/state: source memory service stores mode and session history.
   - Backend dependencies: ReAct agent, STT service, TTS service, optional external research provider.
   - Security risks: audio uploads and transcripts must stay scoped to the session.
   - UI needs: mode toggle, prompt, audio upload, TTS button, session/history controls.

4. PR Copilot Review Agent
   - Features: GitHub PR fetch, Bandit, Flake8, diff chunking, LLM review, output validation/retry, webhook handling, comment posting.
   - Edge cases: missing GitHub token, missing PR/repo, large diffs, no Python files, invalid webhook signature, dry-run vs posting.
   - Caching/state: no durable cache required beyond task output; PR review is recomputed from GitHub and local analyzers.
   - Backend dependencies: GitHub token, webhook secret, Bandit, Flake8, configured LLM provider.
   - Security risks: webhook signatures must be checked and GitHub tokens must never be rendered.
   - UI needs: repo, PR number, dry-run toggle, webhook status, findings cards.

5. Pian Labs ALOS Agent
   - Features: MongoDB-first logistics workspace, CSV/Excel/REST/remote-Mongo onboarding, start-empty schema, entity registry, record list/create/update, weather-aware routing with Open-Meteo and OSRM, clarification flow.
   - Edge cases: missing entity, missing route endpoints, unavailable MongoDB, API import shape mismatch, bad workbook sheets, remote Mongo connection failures, geocode/weather/OSRM failures.
   - Caching/state: MongoDB is source of truth; built-in sample data is only a safe read fallback.
   - Backend dependencies: MongoDB, optional remote Mongo source, Open-Meteo, OSRM, optional LLM provider.
   - Security risks: remote Mongo URIs and API headers must stay request-scoped and out of UI cards.
   - UI needs: onboarding upload controls, entity selector, record table cards, route inputs, clarification cards.

## Ten Use Cases Per Agent

### LeadGen
1. Find 25 seed-stage SaaS founders.
2. Enrich companies from a location-specific search.
3. Score leads by ICP fit.
4. Fetch stored leads for one session.
5. Continue an existing session.
6. Clear a stale session.
7. Handle missing prompt with a needs-input card.
8. Run without Redis and return a safe failure.
9. Run without MongoDB and return a safe failure.
10. Create a new session ID.

### Marketing
1. Generate Instagram launch copy from text.
2. Analyze a product image and create copy.
3. Generate campaign strategy.
4. Edit latest poster HTML.
5. Save product analysis.
6. Load product analysis.
7. List marketing sessions.
8. Load generated content.
9. Switch configured LLM provider.
10. Explain missing provider credentials without raw errors.

### ARIA
1. Host an interview-style conversation.
2. Create a podcast script.
3. Switch to host mode.
4. Switch to creator mode.
5. Transcribe voice input.
6. Answer voice input through the agent.
7. Generate TTS MP3.
8. Load session history.
9. Clear session history.
10. Handle unclear audio.

### PR Copilot
1. Dry-run review a PR.
2. Review and post comments when dry_run is false.
3. Check webhook readiness.
4. Accept GitHub pull_request opened webhook.
5. Ignore unsupported webhook event.
6. Reject invalid webhook signature.
7. Handle missing repo.
8. Handle missing PR number.
9. Surface Bandit and Flake8 counts.
10. Preserve LLM validation and retry flow.

### ALOS
1. Describe workspace.
2. Summarize shipments.
3. List filtered records.
4. Insert a Mongo-backed record.
5. Update Mongo-backed records with filters.
6. Check route weather from origin to destination.
7. Import CSV rows.
8. Import Excel workbook sheets as entities.
9. Pull records from REST API JSON or clone selected Mongo collections.
10. Start from the built-in empty logistics schema and route natural-language prompts to tools.
