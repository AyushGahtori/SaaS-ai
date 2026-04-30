# CI/CD Multi-Developer Agent Logic

## What `src/lib/api.ts` Does

`src/lib/api.ts` is the central place where the frontend decides which backend agent environment to use.

It knows four main things:

1. Which developer owns the current branch.
2. Which API prefix should be used.
3. Which local port should be used during local development.
4. What to do when the branch is not a developer branch.

## Branch Rules

Developer branches must start with one of these prefixes:

```txt
aaron/
agamya/
naveen/
gunjan/
```

Examples:

```txt
aaron/fix-github-agent
agamya/fix-linkedin-agent
naveen/fix-agent-status
gunjan/fix-seo-agent
```

The helper maps those branches like this:

```txt
aaron/*  -> Aaron backend
agamya/* -> Agamya backend
naveen/* -> Naveen backend
gunjan/* -> Gunjan backend
anything else -> production backend
```

So if the branch is:

```txt
aaron/fix-github-agent
```

the frontend uses Aaron's backend route:

```txt
/api/aaron
```

If the branch is:

```txt
main
```

or:

```txt
ci-cd-development
```

or:

```txt
fix/navbar
```

the frontend falls back to normal production behavior:

```txt
/api
```

## Why This Helps

Without this helper, API routing logic would be scattered across many files.

That would make the setup hard to maintain because every new developer or routing rule would require changes in many places.

With this helper, the rules live in one place.

For example, if later we add another developer:

```txt
sarah/*
```

we update the helper once instead of searching the whole codebase.

## `NEXT_PUBLIC_API_BASE`

`NEXT_PUBLIC_API_BASE` is the public base URL of the EC2 API server.

Current value:

```env
NEXT_PUBLIC_API_BASE=http://35.154.54.246
```

This is only the starting part of the URL.

The branch logic adds the correct prefix after it.

Example for Aaron:

```txt
Base:
http://35.154.54.246

Prefix:
/api/aaron

Agent path:
/github/action

Final URL:
http://35.154.54.246/api/aaron/github/action
```

Example for production:

```txt
Base:
http://35.154.54.246

Prefix:
/api

Agent path:
/github/action

Final URL:
http://35.154.54.246/api/github/action
```

The value starts with `NEXT_PUBLIC_` because frontend browser code needs to read it.

It is safe to expose because it is not a secret. It is only a public server address.

## Port Mapping

Production agents keep their normal ports.

Example:

```txt
Production GitHub agent -> 8006
```

Developer agents use offsets:

```txt
Aaron  -> production port + 1000
Agamya -> production port + 1100
Naveen -> production port + 1200
```

So:

```txt
Production GitHub agent -> 8006
Aaron GitHub agent      -> 18006
Agamya GitHub agent     -> 28006
Naveen GitHub agent     -> 38006
Gunjan GitHub agent     -> 48006
```

The frontend does not call these ports directly in deployed environments.

Instead, it calls clean Nginx URLs:

```txt
/api/aaron/github/action
/api/agamya/github/action
/api/naveen/github/action
/api/gunjan/github/action
```

Nginx then sends the request to the correct internal port.

Local frontend development also uses the EC2 backend.

Developers should not run agent services locally. If Aaron runs the frontend
locally from an `aaron/*` branch, the frontend should still call:

```txt
http://35.154.54.246/api/aaron/...
```

not:

```txt
http://localhost:9006
```

## EC2 Folder Logic

Production code lives in:

```txt
/home/ubuntu/app
```

Developer copies live in:

```txt
/home/ubuntu/app-aaron
/home/ubuntu/app-agamya
/home/ubuntu/app-naveen
/home/ubuntu/app-gunjan
```

Each developer folder is a separate working copy of the same EC2 GitHub repository.

These folders should not be pushed as folders into GitHub.

The GitHub repository should contain the actual backend code, not the runtime folder layout.

Good:

```txt
agents/github-agent/server.py
agents/github-agent/api/server.py
ec2_shared/oauth_router.py
```

Bad:

```txt
app-aaron/
app-agamya/
app-naveen/
app-gunjan/
```

The developer folders are deployment/runtime folders on the EC2 machine only.

## Systemd Service Logic

Production service:

```txt
github-agent.service
```

Aaron service:

```txt
aaron-github-agent.service
```

Agamya service:

```txt
agamya-github-agent.service
```

Naveen service:

```txt
naveen-github-agent.service
```

Gunjan service:

```txt
gunjan-github-agent.service
```

Aaron's GitHub service uses port `18006`.

Production GitHub service uses port `8006`.

This is only a runtime/deployment difference.

Aaron changing actual GitHub agent code should not mean production permanently changes to port `18006`.

Production should only use `18006` if someone accidentally commits and merges Aaron-specific service configuration.

That should be avoided.

## Important Git Rule

Developer branches should push actual code changes only.

They should not push:

```txt
.env
.secrets
runtime data
developer-generated systemd units
developer-generated Nginx config
virtualenv folders
logs
cache files
```

They should push code like:

```txt
agents/github-agent/server.py
agents/github-agent/api/server.py
agents/github-agent/main.py
ec2_shared/*.py
requirements.txt
```

## Recommended Safe Workflow

When Aaron fixes a GitHub agent bug:

1. He works in:

```txt
/home/ubuntu/app-aaron
```

2. He checks out:

```txt
aaron/fix-github-agent
```

3. He changes only the actual agent code.

4. He restarts only his service:

```bash
sudo systemctl restart aaron-github-agent
```

5. He tests through his Vercel preview branch:

```txt
aaron/fix-github-agent
```

6. He commits only actual code changes.

7. He opens a PR from:

```txt
aaron/fix-github-agent
```

into:

```txt
ci-cd-development
```

8. After review, the actual code change can be merged.

The developer runtime service files should not be merged into production.

## Implemented Git Safety Guardrails

The EC2 repo includes safety guardrails so developer runtime config does not get merged into production by mistake.

These guardrails are on the EC2 repo `ci-cd-development` branch.

They include:

```txt
.gitignore
.gitattributes
.githooks/pre-commit
.github/workflows/git-safety.yml
scripts/check_git_safety.sh
```

### What `.gitignore` Does

`.gitignore` hides untracked runtime junk and private files, such as:

```txt
.env
.env.*
.secrets/
venv/
__pycache__/
*.log
*.pem
serviceAccountKey.json
systemd/aaron-*.service
systemd/agamya-*.service
systemd/naveen-*.service
systemd/gunjan-*.service
```

This helps prevent accidental staging of files that should never be committed.

Important: `.gitignore` does not protect files that are already tracked.

That is why we also added a pre-commit hook and GitHub Actions check.

### What The Pre-Commit Hook Does

The tracked pre-commit hook runs:

```bash
scripts/check_git_safety.sh --staged
```

It blocks commits that include:

```txt
.env files
secrets
virtualenv folders
logs
developer-only service files
developer-only Nginx config
production config pointing to app-aaron, app-agamya, app-naveen, or app-gunjan
```

So if Aaron accidentally stages this:

```txt
systemd/aaron-github-agent.service
```

the commit is blocked.

If someone accidentally edits a production service file so it points to:

```txt
/home/ubuntu/app-aaron
```

the commit is also blocked.

### What GitHub Actions Does

The GitHub workflow runs the same safety check on pushes and PRs.

This means even if someone bypasses local Git hooks, the PR still fails before merge.

It also runs on every branch push, so developers get early feedback before they open a PR.

## Safe Developer Deploy Script

The EC2 repo includes:

```txt
scripts/dev_deploy_agent.sh
```

Example:

```bash
scripts/dev_deploy_agent.sh aaron github-agent aaron/fix-github-agent
```

This script:

```txt
uses only /home/ubuntu/app-aaron
requires Aaron's branch to start with aaron/
resets that folder to origin/aaron/fix-github-agent
installs the Git safety hook
restarts only aaron-github-agent.service
never restarts github-agent.service
```

This prevents developers from accidentally pulling code into the wrong folder
or restarting production services.

### What Developers Should Commit

Developers should commit reusable code only, such as:

```txt
agents/
ec2_shared/
requirements.txt
```

They should not commit runtime/deployment state, such as:

```txt
systemd/
nginx/
.env
.secrets
venv/
__pycache__/
*.log
```

Production config can still be tracked intentionally.

Developer runtime config must never be tracked.
