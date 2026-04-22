# Devika Engineer Agent Test Matrix

This matrix covers prompt-to-action behavior, edge cases, and cache expectations.

## Prompt Cases

1. Prompt: "Plan a retry-safe webhook processor with dead-letter queue and idempotency."
- Expected action: `plan_project`
- Expected type: `devika_plan_result`
- Cache: yes (same prompt should hit cache)

2. Prompt: "Research best practices for multi-tenant RBAC in SaaS."
- Expected action: `research_plan`
- Expected type: `devika_research_result`
- Cache: yes (query synthesis + findings are cacheable)

3. Prompt: "Implement feature: add optimistic UI updates with rollback when API fails."
- Expected action: `implement_feature`
- Expected type: `devika_feature_result`
- Cache: yes

4. Prompt: "Fix this bug: TypeError reading status from undefined."
- Expected action: `fix_bug`
- Expected type: `devika_bugfix_result`
- Cache: yes (same error payload)

5. Prompt: "How should I run this Next.js app in staging with strict env validation?"
- Expected action: `run_project`
- Expected type: `devika_run_result`
- Cache: yes

6. Prompt: "Give me a production deployment + rollback checklist for this API service."
- Expected action: `deploy_project`
- Expected type: `devika_deploy_result`
- Cache: yes

7. Prompt: "Generate an engineering report for the payment retries module."
- Expected action: `generate_report`
- Expected type: `devika_report_result`
- Cache: yes

8. Prompt: "Answer: why should we normalize agent action aliases before dispatch?"
- Expected action: `answer_question`
- Expected type: `devika_answer_result`
- Cache: yes

9. Prompt: "Onboard this repo: https://github.com/example-org/service-core"
- Expected action: `repo_intake`
- Expected type: `devika_repo_result`
- Cache: yes

10. Prompt: "Estimate tokens for this prompt: ...", then request `list_snapshots` and `agent_status`.
- Expected actions: `token_estimate`, `list_snapshots`, `agent_status`
- Expected types: `devika_token_result`, `devika_snapshots_result`, `devika_status_result`
- Cache: no for status/snapshots; token estimate is deterministic and cache-safe but currently treated as non-cacheable to avoid stale confusion.

## Failure Cases

- Missing `userId` -> `needs_input` with `suggestedInputs: ["userId"]`.
- Unsupported action -> `failed` with `supportedActions` list.
- `repo_intake` without valid URL -> `needs_input` with `suggestedInputs: ["repositoryUrl"]`.
- Missing prompt/objective for prompt-driven actions -> `needs_input` with `suggestedInputs: ["prompt"]`.

## Cache Behavior

- Cache key includes action, chat/session IDs, prompt/objective, key context, files, constraints, and structured context.
- Two-layer cache:
  - In-memory hot cache (TTL, fastest path)
  - Persistent store cache (Firestore when available, local JSON fallback)
- Response includes:
  - `result.cache.hit`
  - `result.cache.source` (`memory`, `store`, or `miss`)
  - `result.cache.cacheKey`
  - `result.cache.ttlSeconds`

## Security Notes

- Repository intake validates host and path shape before using URL data.
- Prompts and logs are truncated for cache-key generation safety.
- No secrets are embedded in code or docs; env placeholders only.
