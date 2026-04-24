# OAuth Popup Redirect Fix

Date: 2026-04-24

## Symptom

OAuth-capable agents opened a provider popup from Vercel production and the popup closed almost immediately. This affected Google, Microsoft, GitHub, GitLab, LinkedIn, and any other detached EC2 agent using the shared OAuth router.

## Root Causes Found

- EC2 OAuth services were using plain HTTP callback URLs such as `http://35.154.54.246/<slug>/auth/callback`. Production OAuth providers generally require HTTPS redirect URLs.
- Only Google had a partial Vercel callback bridge. The other OAuth providers still fell back to EC2 HTTP callbacks.
- OAuth callback result pages auto-closed on both success and failure, hiding provider errors such as redirect URI mismatch.
- The EC2 callback script rendered a Python dict directly into JavaScript. Values like `None` could break `postMessage`, so the main app might not receive success/error events reliably.
- Several optional OAuth agents on EC2 currently do not have `.env` files, so they still need provider credentials before real login can complete.

## Fix Applied

- EC2 shared OAuth router now sends production OAuth redirects through HTTPS Vercel bridge callbacks:
  - Google: `https://pian-labs.vercel.app/api/google-auth/callback`
  - Microsoft: `https://pian-labs.vercel.app/api/microsoft-auth/callback`
  - Other OAuth agents: `https://pian-labs.vercel.app/api/agents/oauth/callback`
- EC2 now signs provider `state` as an `ec2.*` bridge token containing the internal state id, provider, and agent slug.
- The generic Vercel callback now detects `ec2.*` state and redirects the callback back to the correct EC2 agent route.
- EC2 callback accepts signed bridge state and consumes the original Firestore state safely.
- Error callback pages no longer auto-close. Success pages still auto-close after posting back to the opener.
- Callback pages HTML-escape error messages and use JSON for `postMessage` payloads.

## Required Provider Console Redirect URLs

Add these production redirect URLs to the relevant OAuth apps:

- Google Cloud OAuth Client: `https://pian-labs.vercel.app/api/google-auth/callback`
- Microsoft Entra App Registration: `https://pian-labs.vercel.app/api/microsoft-auth/callback`
- GitHub OAuth App: `https://pian-labs.vercel.app/api/agents/oauth/callback`
- GitLab OAuth Application: `https://pian-labs.vercel.app/api/agents/oauth/callback`
- LinkedIn Developer App: `https://pian-labs.vercel.app/api/agents/oauth/callback`
- Notion, Canva, Discord, Dropbox, Jira/Atlassian, Zoom: `https://pian-labs.vercel.app/api/agents/oauth/callback`

## Verification

- `npm run build` passed locally and on Vercel production deploy.
- `npx eslint src/app/api/agents/oauth/callback/route.ts` passed.
- `uv run python -m py_compile EC2/ec2_shared/oauth_router.py` passed.
- EC2 OAuth services were restarted and reported active.
- Smoke test confirmed provider auth URLs now include HTTPS Vercel callback redirects and signed `ec2.` state for Google, Microsoft, and GitHub.
- Production Vercel callback smoke test confirmed generic `ec2.` state redirects back to `http://35.154.54.246/<slug>/auth/callback`.

## Avoid Later

- Do not point production OAuth providers directly at the EC2 public IP over HTTP.
- Keep callback bridge behavior in `EC2/ec2_shared/oauth_router.py` shared for all OAuth-capable agents.
- When adding a new OAuth agent, add its slug/base URL mapping in `src/app/api/agents/oauth/callback/route.ts` and register the generic Vercel callback URL in the provider console.
- Keep OAuth error pages visible; auto-closing failure pages makes redirect/config bugs look like popup bugs.
