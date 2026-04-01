# Agent Integration Checklist

Current checklist for adding a new agent to SnitchX / AI Everyone end to end.

## Web App

1. Add the agent to `src/lib/agents/catalog.ts`.
2. If the agent needs OAuth, add its scopes in the same catalog entry.
3. Add marketplace card metadata in `src/lib/agents/marketplace.ts`.
4. Add or confirm the orchestration prompt rules in `src/app/api/chat/route.ts`.
5. Add the runtime route in `src/lib/firestore-tasks.server.ts`.
6. Add provider auth handoff handling in:
   `src/app/api/agents/oauth/start/route.ts`
   `src/lib/agents/ec2-oauth.server.ts`
   `src/lib/agents/user-access.server.ts`
   `src/app/api/agents/route.ts`
7. If the agent is seeded into Firestore for admin visibility, run `npx tsx scripts/seed-agents.ts`.

## Python Agent

1. Create `agents/<agent-name>/api/server.py` with the full action implementation.
2. Add `agents/<agent-name>/server.py` as the root FastAPI entrypoint.
3. Add `agents/<agent-name>/main.py` as the launcher wrapper when needed by deploy scripts.
4. Add `agents/<agent-name>/requirements.txt`.
5. Add `.env.example` when the agent needs provider credentials or service keys.

## Cloud Function

1. If Cloud Functions are used in your current deployment path, add/update route mapping in `functions/index.js`.
2. Keep auth source-of-truth aligned with detached EC2 OAuth ownership.

## EC2 Runtime

1. Mirror the agent folder into `EC2/agents/<agent-name>/`.
2. Ensure each agent is self-contained (`main.py`, `server.py`, full business logic, `.env.example`).
3. If OAuth agent, expose `GET /auth/login`, `GET /auth/callback`, `GET /auth/status`, `POST /auth/logout`.
4. Add OAuth registration via `ec2_shared/oauth_router.py` integration in `server.py`.
5. Add the systemd unit in `EC2/systemd/`.
6. Add the nginx proxy route in `EC2/nginx/sites-available/agents`.
7. Make sure `EC2/deploy.sh` installs, enables, and health-checks the new service.
8. Confirm no imports from outside `EC2/` runtime.

## Verification

1. Run `npx tsc --noEmit` from `ai-everyone/`.
2. Compile Python files or start the FastAPI service to confirm imports are valid.
3. Test install/connect from `/agents`.
4. Trigger the agent through chat and confirm the task reaches `success`.
5. For OAuth agents, verify Connect flow opens `/${slug}/auth/login` on `AGENT_PUBLIC_BASE_URL` and callback succeeds.
