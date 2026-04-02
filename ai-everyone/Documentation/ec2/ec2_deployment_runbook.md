# EC2 Deployment Runbook

Canonical runbook for deploying the detached EC2 agent runtime.

## Architecture

- Only `EC2/` is deployed to host (`/home/ubuntu/app`).
- Main AI Everyone app is not deployed on this host.
- Each `EC2/agents/<agent>` is self-contained (`main.py`, `server.py`, logic, env).
- Nginx exposes public routes and forwards to local FastAPI services.
- OAuth is owned by EC2 agents with signed-handoff validation.

## Required Shared Env

For OAuth-capable agents:

- `AGENT_PUBLIC_BASE_URL` (prefer domain, not raw IP long-term)
- `AGENT_OAUTH_SHARED_SECRET` (same as web app secret)
- `FIREBASE_SERVICE_ACCOUNT_KEY=/home/ubuntu/app/.secrets/serviceAccountKey.json`

## Provider Env (as needed)

- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Teams/Microsoft: `GRAPH_TENANT_ID`, `MICROSOFT_CLIENT_ID` or `GRAPH_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`
- Notion/Canva/Discord/Dropbox/GitHub/GitLab/Jira/LinkedIn/Zoom client id + secret
- Freshdesk: `FRESHDESK_API_KEY` (and `FRESHDESK_DOMAIN` if required)
- Greenhouse: `GREENHOUSE_API_KEY`
- Maps/Emergency: `GOOGLE_MAPS_API_KEY`

OAuth callback pattern for provider consoles:

- `${AGENT_PUBLIC_BASE_URL}/<slug>/auth/callback`

Google callback note (important):

- If Google uses the web callback bridge, configure Google Console with `${WEB_BASE_URL}/api/google-auth/callback` instead.
- The value in Google Console must exactly match the runtime `redirect_uri` (scheme, host, path, trailing slash).
- If `AGENT_PUBLIC_BASE_URL` or domain changes, update callback URIs immediately or Google auth will fail.

## Deploy

```bash
ssh -i <key>.pem ubuntu@<host>
cd /home/ubuntu/app
git pull
sudo ./deploy.sh
```

## What `deploy.sh` does

- Validates expected directories.
- Builds/updates Python venv for each agent.
- Installs dependencies from each `requirements.txt`.
- Installs and restarts all systemd units.
- Installs and validates Nginx config.
- Runs local/public health checks and OAuth route probes.

## Post-Deploy Checks

```bash
# Service state
for s in teams-agent todo-agent google-agent notion-agent maps-agent emergency-response-agent canva-agent day-planner-agent discord-agent dropbox-agent freshdesk-agent github-agent gitlab-agent greenhouse-agent jira-agent linkedin-agent zoom-agent; do
  systemctl is-active "$s"
done

# Public health
curl "${AGENT_PUBLIC_BASE_URL}/teams/health"
curl "${AGENT_PUBLIC_BASE_URL}/linkedin/health"
curl "${AGENT_PUBLIC_BASE_URL}/emergency/health"

# OAuth route readiness (400 without handoff is expected)
curl -i "${AGENT_PUBLIC_BASE_URL}/linkedin/auth/login"
```

## Troubleshooting

- If `/auth/login` times out publicly but works on localhost:
  - Check Nginx route blocks and reload Nginx.
- If Connect popup opens old IP:
  - Update web app env (`*_AGENT_URL`, `AGENT_SERVER_URL`) and restart Next.js.
- If OAuth fails with invalid scopes:
  - Verify provider product approvals and requested scope list match exactly.
- If Google shows `Error 400: invalid_request` or "Access blocked: Authorization Error":
  - Compare the exact `redirect_uri` sent by runtime with Google Console Authorized redirect URIs.
  - Ensure the same OAuth client ID is used in runtime and in the console page you updated.
  - Confirm callback mode is consistent (direct EC2 callback vs web callback bridge).
