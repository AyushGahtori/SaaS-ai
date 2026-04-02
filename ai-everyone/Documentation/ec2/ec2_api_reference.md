# EC2 Agent API Reference

Detached runtime contract for all EC2 agents.

## Base URL

- Public host: `${AGENT_PUBLIC_BASE_URL}`
- Internal services: `127.0.0.1:<port>` behind Nginx

## Common Response Rules

- Requests use `Content-Type: application/json`.
- Business failures often return HTTP `200` with `status: "failed"`.
- Missing OAuth connection should return `status: "action_required"` with `auth_url`.

## Health Routes

- `GET /health` (teams health alias)
- `GET /teams/health`
- `GET /todo/health`
- `GET /google/health`
- `GET /notion/health`
- `GET /maps/health`
- `GET /emergency/health`
- `GET /canva/health`
- `GET /dayplanner/health`
- `GET /discord/health`
- `GET /dropbox/health`
- `GET /freshdesk/health`
- `GET /github/health`
- `GET /gitlab/health`
- `GET /greenhouse/health`
- `GET /jira/health`
- `GET /linkedin/health`
- `GET /zoom/health`

## Action Routes

- `POST /teams/action`
- `POST /email/action`
- `POST /calendar/action`
- `POST /todo/action`
- `POST /google/action`
- `POST /notion/action`
- `POST /maps/action`
- `POST /emergency/action`
- `POST /canva/action`
- `POST /dayplanner/action`
- `POST /discord/action`
- `POST /dropbox/action`
- `POST /freshdesk/action`
- `POST /github/action`
- `POST /gitlab/action`
- `POST /greenhouse/action`
- `POST /jira/action`
- `POST /linkedin/action`
- `POST /zoom/action`

## OAuth Ownership (Detached)

OAuth agents expose:

- `GET /<slug>/auth/login?handoff=<signed-token>`
- `GET /<slug>/auth/callback`
- `GET /<slug>/auth/status?handoff=<signed-token>`
- `POST /<slug>/auth/logout`

OAuth slugs:

- `teams`, `google`, `notion`, `canva`, `discord`, `dropbox`, `github`, `gitlab`, `jira`, `linkedin`, `zoom`

The web app/backend creates the signed handoff token using `AGENT_OAUTH_SHARED_SECRET`.
EC2 validates that token before starting OAuth.

### Google Redirect URI Rules (Critical)

Google OAuth is strict about `redirect_uri`. The request is rejected if the runtime value does not exactly match one of the URIs configured in Google Cloud Console.

Google can reject login when:

- `redirect_uri` is not present in **Authorized redirect URIs** for the same OAuth client.
- Protocol mismatch (`http` vs `https`), host mismatch, path mismatch, or trailing-slash mismatch.
- You switched EC2 public IP/domain but did not update both app env and Google Console.
- The app is using one callback route while the OAuth client is configured for another.

Detached EC2 flow in this project:

- Browser starts connect in web app.
- Web app sends user to EC2 `/<slug>/auth/login?handoff=...`.
- Provider returns to configured callback URI.
- Callback bridge (if used) forwards `code/state/error` to EC2 `/<slug>/auth/callback`.

For Google, use one of these patterns consistently:

- Direct EC2 callback: `${AGENT_PUBLIC_BASE_URL}/google/auth/callback`
- Web-app callback bridge: `${WEB_BASE_URL}/api/google-auth/callback` (bridge forwards to EC2 callback)

Do not mix patterns between code and console settings.

## Credential Storage

Firestore path:

- `users/{uid}/providerConnections/{provider}`

Stored fields:

- `accessToken`
- `refreshToken`
- `expiresAt`
- `scopes`
- `metadata`
- `bundleId`
- `connectedAt`
- `updatedAt`

## Auth Modes by Agent

- OAuth: `teams-agent`, `google-agent`, `notion-agent`, `canva-agent`, `discord-agent`, `dropbox-agent`, `github-agent`, `gitlab-agent`, `jira-agent`, `linkedin-agent`, `zoom-agent`
- API key: `freshdesk-agent`, `greenhouse-agent`
- Internal/no-auth: `todo-agent`, `day-planner-agent`, `maps-agent`, `emergency-response-agent`

## JS-Parity Notes

- `canva-agent` keeps JS-parity `coming_soon` behavior.
- `freshdesk-agent` and `jira-agent` keep JS-parity stub responses.

## Example Smoke Checks

```bash
curl "${AGENT_PUBLIC_BASE_URL}/teams/health"

curl -X POST "${AGENT_PUBLIC_BASE_URL}/todo/action" \
  -H "Content-Type: application/json" \
  -d '{"taskId":"smoke-1","userId":"smoke-user","agentId":"todo-agent","action":"list_tasks"}'
```
