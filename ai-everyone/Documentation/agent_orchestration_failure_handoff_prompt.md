# Handoff Prompt: Gmail Agent Orchestration Still Failing

Use this prompt with a debugging agent or engineer.

---

You are debugging Pian / AI Everyone, a Next.js + Firebase + detached EC2 Python-agent system. The critical problem is that chat-agent orchestration still fails for Gmail follow-up tasks even after rebuilding the routing flow.

## EC2 Access

SSH into the EC2 runtime:

```powershell
ssh -o StrictHostKeyChecking=no -i "C:\Users\gahto\Downloads\agent-key.pem" ubuntu@35.154.54.246
```

If that key path is different on the machine, use the documented fallback pattern:

```powershell
ssh -o StrictHostKeyChecking=no -i "C:\Users\<you>\Downloads\agent-key.pem" ubuntu@35.154.54.246
```

Once inside EC2:

```bash
cd /home/ubuntu/app
hostname && uptime
git status --short
git log -1 --oneline
systemctl status google-agent --no-pager
journalctl -u google-agent -n 250 --no-pager
curl -i http://127.0.0.1:8300/health
curl -i http://35.154.54.246/google/health
```

Also inspect whether the deployed EC2 Google agent contains the latest context-forwarding code:

```bash
grep -R "conversation_context" -n /home/ubuntu/app/EC2/agents/google-agent /home/ubuntu/app/agents/google-agent 2>/dev/null
grep -R "_hydrate_email_cache_from_context" -n /home/ubuntu/app/EC2/agents/google-agent /home/ubuntu/app/agents/google-agent 2>/dev/null
grep -R "_get_contextual_cached_message" -n /home/ubuntu/app/EC2/agents/google-agent /home/ubuntu/app/agents/google-agent 2>/dev/null
```

## User-Facing Failure

The current user flow:

1. User says: `retrieve my last 5 mails`
2. App delegates to Google Workspace Agent, action `list_emails`.
3. This part now works: UI shows a table of 5 Gmail messages.
4. User says: `summarize the first one from this`
5. App delegates to Google Workspace Agent, action `read_email`.
6. Instead of reading the first email from the previously retrieved table, the system responds:

```text
I couldn't retrieve the email because the request didn't include a valid message ID.
Please specify which email you would like me to read by providing its index number from the list or the full subject line.

Next step: Provide the specific index or subject line of the email you wish to read.
Needed: Read email at index 1, Read email with subject: Failed preview deployment
```

7. User then provides an exact visible sender/subject and says `this one`.
8. The system returns:

```text
The AI service hit an internal issue. Please retry shortly.
```

9. Further attempts such as:

```text
summarize the first mail
summarize the first one
```

sometimes end in generic UI error:

```text
Chat issue
I could not complete that response right now.
```

## What Was Tried

A first architectural rebuild was implemented in the main app:

- Added deterministic routing in `src/lib/agents/orchestrator.ts`.
- Gmail requests like `retrieve my last 5 mails` now bypass parent LLM routing and directly become:

```json
{
  "agent_required": "google-agent",
  "action": "list_emails",
  "parameters": {
    "agent_type": "gmail",
    "parameters": "retrieve my last 5 mails",
    "limit": "5",
    "count": "5",
    "maxResults": "5",
    "pageSize": "5"
  }
}
```

- `src/app/api/chat/route.ts` now loads recent `agentTasks` for the same chat and builds `recentAgentContext`.
- `route.ts` passes `conversation_context` into child agent input.
- `agents/google-agent/server.py` was patched to accept:

```python
conversation_context: Dict[str, Any] | None = None
llm_provider: str | None = None
model: str | None = None
```

- `agents/google-agent/server.py` forwards:

```python
agent_outputs
pending_task
recent_tasks
llm_provider
model
```

into `agent.handle(..., context=agent_context)`.

- `agents/google-agent/agents/gmail_agent.py` was patched with `_hydrate_email_cache_from_context`, `_get_contextual_cached_message`, and `_get_contextual_sender_email`.
- Local build passed:

```bash
npx tsc --noEmit
npm run build
python -m py_compile agents/google-agent/server.py agents/google-agent/agents/gmail_agent.py
```

## Remaining Problem

The first Gmail list task works, but follow-up Gmail read/summarize still does not resolve the selected email. The likely issue is one or more of:

1. The Vercel-deployed Next.js route has the new deterministic router, but the EC2 Google agent runtime does not have the matching `conversation_context` and Gmail cache hydration patches.
2. The main app sends `conversation_context`, but `executeAgentTask` / EC2 request body is not actually forwarding it to the deployed `/google/action` endpoint.
3. `loadRecentAgentContext` is reading `agentOutput.result.emails`, but the actual Firestore `agentTasks` shape may differ in production.
4. `GmailAgent.read_email()` still calls `extract_parameters()` and may ignore the cached first-row context when the user says `first one`, `this one`, or gives the visible sender/subject.
5. The internal Gemini error may come from `BaseAgent.extract_parameters()` / `llm_complete()` on EC2 due to missing or mismatched `GEMINI_API_KEY`, model alias, or provider config.
6. The UI shows an agent card before the result resolves, but terminal failures may be normalized into generic `Chat issue`, hiding the actual EC2 error.

## Files To Inspect

Main app:

- `src/app/api/chat/route.ts`
- `src/lib/agents/orchestrator.ts`
- `src/lib/firestore-tasks.server.ts`
- `src/lib/agent-server-url.ts`
- `src/modules/chat/context/chat-context.tsx`
- `src/modules/chat/ui/components/agent-task-message.tsx`

Google agent:

- `agents/google-agent/server.py`
- `agents/google-agent/agents/gmail_agent.py`
- `agents/google-agent/agents/base_agent.py`

EC2 runtime equivalent paths, usually one of:

- `/home/ubuntu/app/EC2/agents/google-agent/server.py`
- `/home/ubuntu/app/EC2/agents/google-agent/agents/gmail_agent.py`
- `/home/ubuntu/app/agents/google-agent/server.py`
- `/home/ubuntu/app/agents/google-agent/agents/gmail_agent.py`

## Required Investigation

Please debug end-to-end:

1. Confirm whether Vercel is calling EC2 or local bundled agent code for `google-agent`.
2. Confirm the exact URL used by `executeAgentTask` for `google-agent`.
3. Check Firestore `agentTasks` documents for the failing chat:
   - `parentLLMRequest.routing_source`
   - `agentInput.action`
   - `agentInput.agent_type`
   - `agentInput.parameters`
   - `agentInput.conversation_context`
   - `agentOutput`
   - `status`
   - `error_context`
4. Confirm whether `agentInput.conversation_context.agent_outputs.gmail.emails` contains the previous 5 email rows.
5. Confirm whether EC2 `GoogleActionRequest` accepts `conversation_context`.
6. Confirm whether EC2 Gmail agent hydrates `_RAM_EMAIL_CACHE` before `read_email`.
7. Check EC2 logs while reproducing:

```bash
journalctl -u google-agent -f
```

8. Find the real exception behind:

```text
The AI service hit an internal issue.
```

9. Fix the follow-up resolution so these all work:

```text
retrieve my last 5 mails
summarize the first one from this
summarize the first mail
summarize this one
summarize the email from Vercel
summarize the email with subject Failed preview deployment
```

## Expected Architecture

The desired behavior is:

- Parent LLM is not required for obvious Gmail routing.
- The previous Gmail list result is persisted in `agentTasks`.
- Follow-up read/summarize requests resolve by index, sender, subject, or contextual reference.
- If the app cannot resolve the target email, it asks a precise clarification without throwing a generic chat error.
- The UI should show the final email summary, not only a delegation card.

## Suggested Fix Direction

Make Gmail follow-up resolution deterministic before using an LLM:

- Parse index phrases:
  - `first one`, `first mail`, `1st`, `number 1`, `top one`
  - `second`, `third`, etc.
- Resolve from `conversation_context.agent_outputs.gmail.emails[index]`.
- If a sender/subject fragment is provided, fuzzy-match against cached rows.
- Pass `message_id` directly into the Gmail agent when available.
- Avoid calling Gemini just to choose a message ID if the context already has a deterministic match.
- Ensure `read_email()` accepts a `message_id` from context/input and skips LLM parameter extraction in that case.

## Deliverables

Please provide:

1. Root cause.
2. Exact files changed.
3. How the fix handles the screenshots above.
4. Commands run on EC2.
5. Local and production verification steps.
6. Any remaining risks.
