# Incident Summary: Agent Runtime + OAuth Failures (2026-04-23)

## Scope
This incident affected agent execution reliability on production (`pian-labs.vercel.app`) and OAuth popup completion for bundle connections.

## User-visible Symptoms
- Agent tasks stuck on "Thinking" and did not complete until another action/message.
- Emergency agent request failed in production.
- OAuth popup opened and then closed quickly without completing connection.

## Confirmed Root Causes
1. EC2 memory exhaustion (primary runtime failure)
- Instance RAM: ~1.9 GiB, no swap configured.
- Most agent services were running `uvicorn --workers 2`.
- With 30+ services, worker count created sustained memory pressure.
- Kernel OOM killer repeatedly terminated Python/uvicorn workers.
- Result: intermittent upstream `502 Bad Gateway` and `connect() failed (111: Connection refused)`.

2. Service import-path fragility after restart
- Some services (e.g., `emergency-response-agent`, `lms-agent`) imported `ec2_shared` but lacked `PYTHONPATH=/home/ubuntu/app`.
- Result after restart: `ModuleNotFoundError: No module named 'ec2_shared'` -> repeated service crash loops.

3. OAuth callback postMessage origin mismatch risk
- Return-origin allowlist policy was not explicitly configured on EC2 for Vercel origin.
- Popup callback can close quickly while parent window never receives completion message.
- Result: apparent auth close/fail behavior.

4. Missing agent HTTP timeout in Vercel execution path
- Agent dispatch in `executeAgentTask` had no request timeout.
- Slow/unhealthy upstream could keep task flow pending too long.

## Fixes Applied
### A) EC2 runtime stabilization (all agents)
- Reduced worker count from `--workers 2` to `--workers 1` in all systemd unit files under `EC2/systemd`.
- Added `Environment=PYTHONPATH=/home/ubuntu/app` to all systemd units.
- Installed and enabled persistent swap:
  - `/swapfile` 4 GiB
  - enabled via `swapon`
  - persisted in `/etc/fstab`
- Reinstalled updated units and restarted all agent services.
- Re-validated all nginx health routes (all returned 200).

### B) OAuth hardening
- Updated EC2 OAuth logic (`EC2/ec2_shared/oauth_router.py`) to preserve backward compatibility when explicit return-origin policy is not configured.
- Configured `OAUTH_ALLOWED_RETURN_ORIGINS` for configured OAuth agent env files to include production Vercel origins.

### C) Vercel app hardening
- Added agent request timeout in server task execution:
  - file: `src/lib/firestore-tasks.server.ts`
  - new env support: `AGENT_HTTP_TIMEOUT_MS` (default 45000 ms)
- Improved OAuth popup reliability in UI by fallback-checking `/api/agents` state when popup closes before postMessage:
  - `src/modules/agents/ui/views/agents-view.tsx`
  - `src/modules/chat/ui/components/agent-install-suggestion-card.tsx`

### D) Deployment
- Deployed updated app to production.
- Deployment id: `dpl_6ykucCRTfqhxnDJeC33LX5T4soQL`
- Production alias active: `https://pian-labs.vercel.app`

## RAM Report (Requested)
### What happened
- The EC2 host ran too many Python workers for available RAM.
- OOM killer terminated workers, causing random agent outages and nginx upstream 502/connection-refused errors.

### Why it looked inconsistent
- Some agents remained up while others were OOM-killed/restarting.
- User observed "sometimes works, sometimes hangs/fails" behavior.

### Current stabilization status
- Workers reduced to 1 per service.
- 4 GiB swap enabled.
- Services restarted and health routes verified.
- This significantly lowers crash probability on the current instance size.

## How to avoid recurrence
1. Keep worker count aligned to memory budget.
- Default to 1 worker per agent on small instances.
- Increase workers only after RAM profiling.

2. Keep swap enabled on low-memory hosts.
- Maintain at least 2-4 GiB swap on 2 GiB RAM instances.

3. Add memory + restart monitoring.
- CloudWatch alarms for RAM/swap usage and restart spikes.
- Alert on repeated systemd restarts and nginx 502 bursts.

4. Standardize service environment.
- Ensure all services include `PYTHONPATH=/home/ubuntu/app`.
- Validate unit files after every deployment.

5. Enforce OAuth environment readiness.
- Set `OAUTH_ALLOWED_RETURN_ORIGINS` (or `WEB_BASE_URL`) for every OAuth agent.
- Keep Vercel production + main preview origins in allowlist.

6. Keep request timeouts for upstream agent calls.
- Prevent indefinitely pending task states due to degraded upstreams.

## Files Changed in this run
- `EC2/ec2_shared/oauth_router.py`
- `EC2/deploy.sh`
- `EC2/systemd/*.service` (worker count + PYTHONPATH)
- `src/lib/firestore-tasks.server.ts`
- `src/modules/agents/ui/views/agents-view.tsx`
- `src/modules/chat/ui/components/agent-install-suggestion-card.tsx`
