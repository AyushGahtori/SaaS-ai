# AWS Architecture and EC2 Integration

This document explains the current production shape after detached EC2 agent migration.

## Core Model

- The EC2 runtime is independent from the Next.js app runtime.
- Only the `EC2/` subtree is deployed on EC2 host.
- Each agent is a standalone microservice under `EC2/agents/<agent-name>`.
- Nginx exposes a single public host and routes to local agent ports.

## Why this model

- Stable deploy boundary for agent services.
- OAuth callback ownership stays with EC2 services.
- Web app can change independently (UI/API evolution) without breaking provider callback handlers.
- Easier migration from IP to domain by changing `AGENT_PUBLIC_BASE_URL` and provider callbacks.

## Runtime Layout

```text
EC2/
├── agents/
├── ec2_shared/
├── nginx/
├── systemd/
└── deploy.sh
```

## Traffic Flow

1. Browser interacts with Next.js app.
2. Next.js backend starts OAuth via signed handoff token.
3. Browser popup opens `AGENT_PUBLIC_BASE_URL/<slug>/auth/login`.
4. EC2 agent handles provider OAuth callback at `/<slug>/auth/callback`.
5. Tokens are stored in Firestore provider connection path.
6. Action routes use stored credentials via `userId` lookup.

## Service Ports

- Teams 8100, Todo 8200, Google 8300, Notion 8400, Maps 8500
- Canva 8001, Day Planner 8002, Discord 8003, Dropbox 8004
- Freshdesk 8005, GitHub 8006, GitLab 8007, Greenhouse 8008
- Jira 8009, LinkedIn 8010, Zoom 8011

## Operational Commands

```bash
cd /home/ubuntu/app
git pull
sudo ./deploy.sh

sudo systemctl status linkedin-agent --no-pager
curl "${AGENT_PUBLIC_BASE_URL}/linkedin/health"
```

## Domain Migration Rule

Never bake fixed EC2 IP in long-term docs/config.

- Use `AGENT_PUBLIC_BASE_URL` everywhere possible.
- Keep provider callback URI pattern:
  - `${AGENT_PUBLIC_BASE_URL}/<slug>/auth/callback`

When domain changes, update env + provider console callback URLs, then restart services.
