# Pian EC2 New Agents

This folder contains the EC2-side integration for the five agents copied from
`ai-everyone/new_agents`.

## Agents

| Agent | Port | Action route |
|---|---:|---|
| LeadGen Agent | 8050 | `/leadgen/action` |
| Marketing Agent | 8051 | `/marketing/action` |
| ARIA Podcast Agent | 8052 | `/aria/action` |
| PR Copilot Review Agent | 8053 | `/pr-copilot/action` |
| Pian Labs ALOS Agent | 8054 | `/alos/action` |

The source folders were copied into `EC2/agents/<agent-slug>/` and wrapped with
small FastAPI adapters. The copied internal logic remains in place; adapters
normalize inputs and outputs for the Pian task contract.

ALOS onboarding supports CSV, Excel workbook sheets, REST API imports, remote
MongoDB cloning, and a built-in starter schema. Marketing and ARIA adapters
accept composer attachments through `file_data_url`, `image_base64`, or
`audio_base64` when the main app forwards uploads.

## App-side URLs

Set these in Vercel or local app env as needed:

```bash
AGENT_SERVER_URL=https://agents.example.com
LEADGEN_AGENT_URL=https://agents.example.com
MARKETING_AGENT_URL=https://agents.example.com
ARIA_PODCAST_AGENT_URL=https://agents.example.com
PR_COPILOT_REVIEW_AGENT_URL=https://agents.example.com
PIAN_LABS_ALOS_AGENT_URL=https://agents.example.com
```

Each route is still addressed by the main app through `AGENT_ENDPOINTS`.

## Validation

```bash
python3 EC2/scripts/validate_new_agents.py
bash -n EC2/deploy.sh
python3 -m py_compile EC2/ec2_shared/*.py EC2/agents/*/server.py
```
