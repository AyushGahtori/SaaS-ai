# EC2 Runtime Readme

This runtime is detached from the main web app.

- Only `EC2/` is deployed on the EC2 host.
- Every agent under `EC2/agents` must run independently from this repo alone.
- OAuth lifecycle is owned by EC2 agents (`/<slug>/auth/*`), not by web-app callback routes.

## Runtime Scope

- Agent services: `EC2/agents/*`
- Shared runtime/auth helpers: `EC2/ec2_shared/*`
- Service management: `EC2/systemd/*`
- Reverse proxy: `EC2/nginx/sites-available/agents`
- Deployment automation: `EC2/deploy.sh`

## Active Services

| Service | Port | Action Route | Health Route |
|---|---:|---|---|
| `teams-agent` | 8100 | `/teams/action` | `/teams/health` |
| `todo-agent` | 8200 | `/todo/action` | `/todo/health` |
| `google-agent` | 8300 | `/google/action` | `/google/health` |
| `notion-agent` | 8400 | `/notion/action` | `/notion/health` |
| `maps-agent` | 8500 | `/maps/action` | `/maps/health` |
| `emergency-response-agent` | 8510 | `/emergency/action` | `/emergency/health` |
| `canva-agent` | 8001 | `/canva/action` | `/canva/health` |
| `day-planner-agent` | 8002 | `/dayplanner/action` | `/dayplanner/health` |
| `discord-agent` | 8003 | `/discord/action` | `/discord/health` |
| `dropbox-agent` | 8004 | `/dropbox/action` | `/dropbox/health` |
| `freshdesk-agent` | 8005 | `/freshdesk/action` | `/freshdesk/health` |
| `github-agent` | 8006 | `/github/action` | `/github/health` |
| `gitlab-agent` | 8007 | `/gitlab/action` | `/gitlab/health` |
| `greenhouse-agent` | 8008 | `/greenhouse/action` | `/greenhouse/health` |
| `jira-agent` | 8009 | `/jira/action` | `/jira/health` |
| `linkedin-agent` | 8010 | `/linkedin/action` | `/linkedin/health` |
| `zoom-agent` | 8011 | `/zoom/action` | `/zoom/health` |

## Base URL Policy

Do not hardcode EC2 public IP in docs or code paths.

- Use `AGENT_PUBLIC_BASE_URL` as the canonical external host.
- This can be an IP during setup and later your production domain.
- Provider OAuth callback URIs must always use:
  - `${AGENT_PUBLIC_BASE_URL}/<slug>/auth/callback`

## Quick Deploy

```bash
cd /home/ubuntu/app
git pull
sudo ./deploy.sh
```

## Separation Rule

- No runtime dependency on `ai-everyone/src` or other web-app internals.
- No callback routing from EC2 into main app for provider OAuth.
- Web app only creates signed handoff token and opens EC2 auth URL.
